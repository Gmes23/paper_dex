import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    const result = await client.query(`
      DELETE FROM candles
      WHERE time < EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')
    `);

    return NextResponse.json({
      deleted: result.rowCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } finally {
    await client.end();
  }
}
