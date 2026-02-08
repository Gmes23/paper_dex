import { NextResponse } from 'next/server';
import crypto from 'crypto';

const nonceStore = new Map<string, { nonce: string; createdAt: number }>();
const NONCE_TTL_MS = 5 * 60 * 1000;

function createNonce() {
  return crypto.randomBytes(16).toString('hex');
}

export async function POST(req: Request) {
  const body = await req.json();
  const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.toLowerCase() : '';

  if (!walletAddress || walletAddress.length !== 42) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const nonce = createNonce();
  nonceStore.set(walletAddress, { nonce, createdAt: Date.now() });

  return NextResponse.json({ nonce });
}

export function getNonce(walletAddress: string) {
  const entry = nonceStore.get(walletAddress);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > NONCE_TTL_MS) {
    nonceStore.delete(walletAddress);
    return null;
  }
  return entry.nonce;
}

export function clearNonce(walletAddress: string) {
  nonceStore.delete(walletAddress);
}
