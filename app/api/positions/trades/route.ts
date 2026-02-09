import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

export async function GET(req: Request) {
  const token = await getAuthTokenFromRequest();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get('limit') ?? 100);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

  const client = createPgClient();
  await client.connect();

  try {
    const res = await client.query(
      `
      SELECT id, symbol, side, entry_price, exit_price, position_size, margin, leverage,
             realized_pnl, status, opened_at, closed_at
      FROM paper_trades
      WHERE user_id = $1
      ORDER BY closed_at DESC
      LIMIT $2
      `,
      [payload.sub, limit]
    );

    const trades = res.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      entryPrice: Number(row.entry_price),
      exitPrice: Number(row.exit_price),
      positionSize: Number(row.position_size),
      margin: Number(row.margin),
      leverage: Number(row.leverage),
      realizedPnl: Number(row.realized_pnl),
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
    }));

    return NextResponse.json({ trades });
  } finally {
    await client.end();
  }
}
