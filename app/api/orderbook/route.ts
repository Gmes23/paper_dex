import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import type { OrderBookData } from '@/lib/types';

type OrderBookInsert = OrderBookData & { source?: string };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? 'BTC').toUpperCase();
  const source = searchParams.get('source') ?? 'mock';

  const client = createPgClient();
  await client.connect();

  try {
    const res = await client.query(
      `
      SELECT symbol, time_ms, bids, asks
      FROM orderbook_snapshots
      WHERE symbol = $1 AND source = $2
      `,
      [symbol, source]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(null);
    }

    const row = res.rows[0];
    return NextResponse.json({
      coin: row.symbol,
      levels: [row.bids, row.asks],
      time: Number(row.time_ms),
    } satisfies OrderBookData);
  } finally {
    await client.end();
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const snapshot = body?.snapshot as OrderBookInsert | undefined;
  const source = typeof body?.source === 'string' ? body.source : 'unknown';

  if (!snapshot?.coin || !Array.isArray(snapshot?.levels)) {
    return NextResponse.json({ inserted: false }, { status: 400 });
  }

  const [bids, asks] = snapshot.levels;
  const timeMs = Number(snapshot.time ?? Date.now());

  const client = createPgClient();
  await client.connect();

  try {
    await client.query(
      `
      INSERT INTO orderbook_snapshots (symbol, time_ms, bids, asks, source)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (symbol, source)
      DO UPDATE SET time_ms = EXCLUDED.time_ms, bids = EXCLUDED.bids, asks = EXCLUDED.asks
      `,
      [snapshot.coin.toUpperCase(), timeMs, JSON.stringify(bids), JSON.stringify(asks), source]
    );

    return NextResponse.json({ inserted: true });
  } finally {
    await client.end();
  }
}
