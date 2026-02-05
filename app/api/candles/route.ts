// app/api/candles/route.ts
import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') ?? 'BTC';
  const interval = searchParams.get('interval') ?? '5m';
  const limit = Number(searchParams.get('limit') ?? 500);

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'gm',
    database: 'fakeprices'
  });
  


  await client.connect();

  const res = await client.query(
    `
    SELECT time, open, high, low, close, volume
    FROM btc_candles
    ORDER BY time ASC
    LIMIT $1
    `,
    [limit]
  );

  await client.end();

  return NextResponse.json(res.rows.map((r) => {
    return ({
      time: Number(r.time),          // seconds
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    })
  }));
}
