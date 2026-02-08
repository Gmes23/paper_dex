import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';

export type JwtPayload = {
  sub: string;
  wallet: string;
};

const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_TTL_SECONDS });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getAuthTokenFromRequest() {
  const headersList = await headers();
  const auth = headersList.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}
