import { createPgClient } from '@/lib/pgClient';

export type AggregatedCandle = {
  symbol: string;
  time: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type AggregatorOptions = {
  flushIntervalMs?: number;
  maxBufferSize?: number;
};

type TradeLike = {
  coin: string;
  px: string;
  sz: string;
  time: number;
};

const DEFAULT_FLUSH_MS = 20000;

// maximun amount of candles allowed without saving to db 
const DEFAULT_MAX_BUFFER = 1000;

export class CandleAggregator {
  private buffer = new Map<string, AggregatedCandle>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private inflight = false;
  private flushIntervalMs: number;
  private maxBufferSize: number;
  private lastFlushAt: number | null = null;
  private lastFlushCount = 0;
  private lastFlushReason: 'interval' | 'buffer' | 'shutdown' | null = null;

  constructor(options: AggregatorOptions = {}) {
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_MS;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER;
  }

  addTrade(trade: TradeLike) {
    const symbol = (trade.coin ?? '').toUpperCase();
    const price = Number(trade.px);
    const size = Number(trade.sz);
    const timeMs = Number(trade.time);

    if (!symbol || !Number.isFinite(price) || !Number.isFinite(size) || !Number.isFinite(timeMs)) {
      console.warn('[Candle Aggregator] Skipping invalid trade', trade);
      return;
    }

    const bucketTime = Math.floor(timeMs / 1000 / 60) * 60;
    const key = `${symbol}-${bucketTime}`;
    const existing = this.buffer.get(key);

    if (!existing) {
      this.buffer.set(key, {
        symbol,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: size,
      });
    } else {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
      existing.volume += size;
    }

    if (this.buffer.size >= this.maxBufferSize) {
      void this.flushCandles('buffer');
    }
  }

  start() {
    if (this.flushTimer) return;
    console.log('[Candle Aggregator] Starting background service...');
    this.flushTimer = setInterval(() => {
      void this.flushCandles('interval');
    }, this.flushIntervalMs);
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  getStats() {
    return {
      bufferSize: this.buffer.size,
      lastFlushAt: this.lastFlushAt,
      lastFlushCount: this.lastFlushCount,
      lastFlushReason: this.lastFlushReason,
      flushIntervalMs: this.flushIntervalMs,
    };
  }

  private cleanupBuffer() {
    const cutoff = Math.floor(Date.now() / 1000) - 120;
    for (const [key, candle] of this.buffer.entries()) {
      if (candle.time < cutoff) this.buffer.delete(key);
    }
  }

  async flushCandles(reason: 'interval' | 'buffer' | 'shutdown') {
    if (this.inflight) return;
    if (this.buffer.size === 0) return;

    this.inflight = true;
    const candles = Array.from(this.buffer.values());

    const values: Array<string | number> = [];
    const rows: string[] = [];

    candles.forEach((candle, index) => {
      const base = index * 7;
      rows.push(
        `($${base + 1}, '1m', $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
      );
      values.push(
        candle.symbol,
        candle.time,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      );
    });

    const query = `
      INSERT INTO candles (symbol, interval, time, open, high, low, close, volume)
      VALUES ${rows.join(', ')}
      ON CONFLICT (symbol, interval, time) DO UPDATE SET
        high = GREATEST(candles.high, EXCLUDED.high),
        low = LEAST(candles.low, EXCLUDED.low),
        close = EXCLUDED.close,
        volume = candles.volume + EXCLUDED.volume,
        updated_at = NOW();
    `;

    const client = createPgClient();

    try {
      await client.connect();
      await client.query(query, values);
      this.cleanupBuffer();
      this.lastFlushAt = Date.now();
      this.lastFlushCount = candles.length;
      this.lastFlushReason = reason;
      console.log(`[Candle Aggregator] Flushed ${candles.length} candles to DB (${reason})`, {
        sample: candles[0]?.symbol,
        newestTime: candles[candles.length - 1]?.time,
      });
    } catch (err) {
      console.error('[Candle Aggregator] Failed to flush candles', err);
    } finally {
      await client.end().catch(() => undefined);
      this.inflight = false;
    }
  }
}
