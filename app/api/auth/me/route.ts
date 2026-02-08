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
      SELECT id, wallet_address, mock_usdc_balance, locked_margin, available_balance, created_at, last_login
      FROM users
      WHERE id = $1
      `,
      [payload.sub]
    );

    const user = res.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        mockUsdcBalance: Number(user.mock_usdc_balance),
        lockedMargin: Number(user.locked_margin),
        availableBalance: Number(user.available_balance),
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
    });
  } finally {
    await client.end();
  }
}
