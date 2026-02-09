import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import type { TradeData } from '@/lib/types';

type TradeInsert = TradeData & { source?: string };
type NormalizedTrade = {
  hash: string;
  symbol: string;
  side: 'B' | 'A';
  price: number;
  size: number;
  timeMs: number;
};

type CandleRow = {
  symbol: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function buildOneMinuteCandles(trades: NormalizedTrade[]): CandleRow[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.timeMs - b.timeMs);
  const buckets = new Map<string, CandleRow>();

  for (const trade of sorted) {
    const symbol = trade.symbol;
    const price = trade.price;
    const size = trade.size;
    const timeMs = trade.timeMs;

    if (!symbol || !Number.isFinite(price) || !Number.isFinite(size) || !Number.isFinite(timeMs)) {
      continue;
    }

    const bucketTime = Math.floor(timeMs / 1000 / 60) * 60;
    const key = `${symbol}-${bucketTime}`;

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        symbol,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: size,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
    existing.volume += size;
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? 'BTC').toUpperCase();
  const rawLimit = Number(searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, rawLimit) : 50;
  const source = searchParams.get('source');

  const client = createPgClient();
  await client.connect();

  try {
    const params: Array<string | number> = [symbol, limit];
    const sourceClause = source ? 'AND source = $3' : '';
    if (source) params.push(source);

    const res = await client.query(
      `
      SELECT trade_id, symbol, side, price, size, time_ms
      FROM trades
      WHERE symbol = $1
      ${sourceClause}
      ORDER BY time_ms DESC
      LIMIT $2
      `,
      params
    );

    const payload: TradeData[] = res.rows.map((row) => ({
      coin: row.symbol,
      side: row.side,
      px: String(row.price),
      sz: String(row.size),
      time: Number(row.time_ms),
      hash: row.trade_id,
    }));

    return NextResponse.json(payload);
  } finally {
    await client.end();
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const trades = Array.isArray(body?.trades) ? (body.trades as TradeInsert[]) : [];
  const source = typeof body?.source === 'string' ? body.source : 'unknown';

  if (trades.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    const normalizedTrades: NormalizedTrade[] = [];
    for (const trade of trades) {
      if (!trade?.coin || !trade?.hash) continue;

      const symbol = trade.coin.toUpperCase();
      const side = trade.side === 'B' ? 'B' : 'A';
      const price = Number(trade.px);
      const size = Number(trade.sz);
      const timeMs = Number(trade.time);

      if (!Number.isFinite(price) || !Number.isFinite(size) || !Number.isFinite(timeMs)) {
        continue;
      }

      normalizedTrades.push({
        hash: trade.hash,
        symbol,
        side,
        price,
        size,
        timeMs,
      });
    }

    if (normalizedTrades.length === 0) {
      return NextResponse.json({ inserted: 0, candlesUpserted: 0 });
    }

    const values: Array<string | number> = [];
    const rows: string[] = [];

    normalizedTrades.forEach((trade, index) => {
      const base = index * 7;
      rows.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
      );
      values.push(trade.hash, trade.symbol, trade.side, trade.price, trade.size, trade.timeMs, source);
    });

    const insertQuery = `
      INSERT INTO trades (trade_id, symbol, side, price, size, time_ms, source)
      VALUES ${rows.join(', ')}
      ON CONFLICT (symbol, trade_id) DO NOTHING
      RETURNING trade_id, symbol, side, price, size, time_ms;
    `;
    const insertedRes = await client.query<{
      trade_id: string;
      symbol: string;
      side: 'B' | 'A';
      price: string;
      size: string;
      time_ms: number;
    }>(insertQuery, values);
    const inserted = insertedRes.rowCount ?? 0;

    const shouldUpsertCandles = source === 'mock';
    const insertedTrades: NormalizedTrade[] = insertedRes.rows.map((row) => ({
      hash: row.trade_id,
      symbol: row.symbol,
      side: row.side,
      price: Number(row.price),
      size: Number(row.size),
      timeMs: Number(row.time_ms),
    }));
    const candles = shouldUpsertCandles ? buildOneMinuteCandles(insertedTrades) : [];

    if (candles.length > 0) {
      const candleValues: Array<string | number> = [];
      const candleRows: string[] = [];

      candles.forEach((candle, index) => {
        const base = index * 7;
        candleRows.push(
          `($${base + 1}, '1m', $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
        );
        candleValues.push(
          candle.symbol,
          candle.time,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        );
      });

      const candleQuery = `
        INSERT INTO candles (symbol, interval, time, open, high, low, close, volume)
        VALUES ${candleRows.join(', ')}
        ON CONFLICT (symbol, interval, time) DO UPDATE SET
          high = GREATEST(candles.high, EXCLUDED.high),
          low = LEAST(candles.low, EXCLUDED.low),
          close = EXCLUDED.close,
          volume = candles.volume + EXCLUDED.volume,
          updated_at = NOW();
      `;

      await client.query(candleQuery, candleValues);
    }

    return NextResponse.json({ inserted, candlesUpserted: candles.length });
  } finally {
    await client.end();
  }
}
