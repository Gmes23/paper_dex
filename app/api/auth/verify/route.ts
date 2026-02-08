import { NextResponse } from 'next/server';
import { verifyMessage } from 'ethers';
import { createPgClient } from '@/lib/pgClient';
import { signJwt } from '@/lib/auth';
import { getNonce, clearNonce } from '@/app/api/auth/nonce/route';

const MESSAGE_PREFIX = 'Sign this message to authenticate. Nonce:';

export async function POST(req: Request) {
  const body = await req.json();
  const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.toLowerCase() : '';
  const signature = typeof body?.signature === 'string' ? body.signature : '';

  if (!walletAddress || walletAddress.length !== 42 || !signature) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const nonce = getNonce(walletAddress);
  if (!nonce) {
    return NextResponse.json({ error: 'Nonce expired or missing' }, { status: 400 });
  }

  const message = `${MESSAGE_PREFIX} ${nonce}`;
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature).toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (recovered !== walletAddress) {
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
  }

  clearNonce(walletAddress);

  const client = createPgClient();
  await client.connect();

  try {
    const now = new Date().toISOString();
    const upsert = await client.query(
      `
      INSERT INTO users (wallet_address, last_login)
      VALUES ($1, $2)
      ON CONFLICT (wallet_address) DO UPDATE SET last_login = EXCLUDED.last_login
      RETURNING id, wallet_address, mock_usdc_balance, locked_margin, available_balance, created_at, last_login
      `,
      [walletAddress, now]
    );

    const user = upsert.rows[0];
    const token = signJwt({ sub: String(user.id), wallet: user.wallet_address });

    return NextResponse.json({
      token,
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
