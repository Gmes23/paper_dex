import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';

const DEFAULT_RETENTION_DAYS = 14;

function getRetentionDays(): number {
  const parsed = Number.parseInt(process.env.CANDLE_RETENTION_DAYS ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_RETENTION_DAYS;
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const retentionDays = getRetentionDays();
  const client = createPgClient();
  await client.connect();

  try {
    const result = await client.query(
      `
      DELETE FROM candles
      WHERE time < EXTRACT(EPOCH FROM NOW() - ($1::int * INTERVAL '1 day'))
      `,
      [retentionDays]
    );

    return NextResponse.json({
      deleted: result.rowCount ?? 0,
      retentionDays,
      timestamp: new Date().toISOString(),
    });
  } finally {
    await client.end();
  }
}
