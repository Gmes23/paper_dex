import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

export async function GET() {
  const token = await getAuthTokenFromRequest();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    const res = await client.query(
      `
      SELECT id, symbol, side, entry_price, position_size, margin, leverage,
             liquidation_price, unrealized_pnl, opened_at
      FROM positions
      WHERE user_id = $1
      ORDER BY opened_at DESC
      `,
      [payload.sub]
    );

    const positions = res.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      entryPrice: Number(row.entry_price),
      positionSize: Number(row.position_size),
      margin: Number(row.margin),
      leverage: Number(row.leverage),
      liquidationPrice: Number(row.liquidation_price),
      unrealizedPnl: Number(row.unrealized_pnl),
      openedAt: row.opened_at,
    }));

    return NextResponse.json({ positions });
  } finally {
    await client.end();
  }
}
