// app/api/candles/route.ts
import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';

type CandleRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
};

function aggregateCandles(candles: CandleRow[], intervalSec: number): CandleRow[] {
  if (candles.length === 0) return [];

  const buckets = new Map<number, CandleRow>();

  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / intervalSec) * intervalSec;
    const existing = buckets.get(bucketTime);

    if (!existing) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function clampLimit(rawLimit: number) {
  if (!Number.isFinite(rawLimit)) return 500;
  return Math.min(1000, Math.max(1, rawLimit));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase();
  const interval = searchParams.get('interval') ?? '1m';
  const limit = clampLimit(Number(searchParams.get('limit') ?? 500));

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(INTERVAL_SECONDS, interval)) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 });
  }

  const intervalSec = INTERVAL_SECONDS[interval];
  const multiplier = Math.max(1, Math.floor(intervalSec / 60));
  const fetchLimit = limit * multiplier;

  const client = createPgClient();
  await client.connect();

  try {
    const res = await client.query(
      `
      SELECT time, open, high, low, close, volume
      FROM candles
      WHERE symbol = $1 AND interval = '1m'
      ORDER BY time DESC
      LIMIT $2
      `,
      [symbol, fetchLimit]
    );

    const oneMinute = res.rows
      .map((row) => ({
        time: Number(row.time),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }))
      .filter((row) => Number.isFinite(row.time))
      .sort((a, b) => a.time - b.time);

    const candles =
      interval === '1m'
        ? oneMinute
        : aggregateCandles(oneMinute, intervalSec);

    const sliced = candles.length > limit ? candles.slice(-limit) : candles;

    return NextResponse.json({ candles: sliced });
  } finally {
    await client.end();
  }
}
