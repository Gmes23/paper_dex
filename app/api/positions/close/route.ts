import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

const SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'ARB']);

async function getMarketPrice(client: ReturnType<typeof createPgClient>, symbol: string) {
  const obRes = await client.query(
    `
    SELECT bids, asks, time_ms
    FROM orderbook_snapshots
    WHERE symbol = $1 AND source = 'live'
    LIMIT 1
    `,
    [symbol]
  );

  if (obRes.rows.length > 0) {
    const row = obRes.rows[0];
    const bids = Array.isArray(row.bids) ? row.bids : [];
    const asks = Array.isArray(row.asks) ? row.asks : [];

    const bestBid = bids.length > 0 ? Number(bids[0]?.px ?? bids[0]?.[0]) : null;
    const bestAsk = asks.length > 0 ? Number(asks[0]?.px ?? asks[0]?.[0]) : null;
    const obTime = Number(row.time_ms ?? 0);

    if (Number.isFinite(obTime) && Date.now() - obTime < 10_000) {
      if (Number.isFinite(bestBid)) return Number(bestBid);
      if (Number.isFinite(bestAsk)) return Number(bestAsk);
    }
  }

  const candleRes = await client.query(
    `
    SELECT close
    FROM candles
    WHERE symbol = $1 AND interval = '1m'
    ORDER BY time DESC
    LIMIT 1
    `,
    [symbol]
  );

  if (candleRes.rows.length === 0) return null;
  const close = Number(candleRes.rows[0].close);
  return Number.isFinite(close) ? close : null;
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromRequest();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json();
  const positionId = Number(body?.positionId);
  if (!Number.isFinite(positionId)) {
    return NextResponse.json({ error: 'Invalid position id' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    await client.query('BEGIN');

    const posRes = await client.query(
      `
      SELECT id, user_id, symbol, side, entry_price, position_size, margin, leverage, opened_at
      FROM positions
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [positionId, payload.sub]
    );

    if (posRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const position = posRes.rows[0];
    if (!SYMBOLS.has(position.symbol)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 });
    }

    const currentPrice = await getMarketPrice(client, position.symbol);
    if (!currentPrice) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Market data unavailable' }, { status: 503 });
    }

    const entryPrice = Number(position.entry_price);
    const size = Number(position.position_size);
    const margin = Number(position.margin);
    const isLong = position.side === 'long';
    const pnl = ((currentPrice - entryPrice) / entryPrice) * size * (isLong ? 1 : -1);

    const userRes = await client.query(
      `
      SELECT mock_usdc_balance, locked_margin, available_balance
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [payload.sub]
    );

    const user = userRes.rows[0];
    const newMock = Number(user.mock_usdc_balance) + pnl;
    const newLocked = Number(user.locked_margin) - margin;
    const availableAfterRelease = Number(user.available_balance) + margin;
    const newAvailable = availableAfterRelease + pnl;

    await client.query(
      `
      UPDATE users
      SET mock_usdc_balance = $1,
          locked_margin = $2,
          available_balance = $3
      WHERE id = $4
      `,
      [newMock, newLocked, newAvailable, payload.sub]
    );

    const tradeRes = await client.query(
      `
      INSERT INTO paper_trades (
        user_id, symbol, side, entry_price, exit_price, position_size, margin, leverage,
        realized_pnl, status, opened_at, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'closed', $10, NOW())
      RETURNING id
      `,
      [
        payload.sub,
        position.symbol,
        position.side,
        entryPrice,
        currentPrice,
        size,
        margin,
        Number(position.leverage),
        pnl,
        position.opened_at,
      ]
    );

    const tradeId = tradeRes.rows[0]?.id ?? null;

    await client.query(
      `
      INSERT INTO balance_history (user_id, change_type, amount, balance_after, trade_id, timestamp)
      VALUES ($1, 'position_closed', $2, $3, $4, NOW())
      `,
      [payload.sub, margin, availableAfterRelease, tradeId]
    );

    await client.query(
      `
      INSERT INTO balance_history (user_id, change_type, amount, balance_after, trade_id, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        payload.sub,
        pnl >= 0 ? 'trade_profit' : 'trade_loss',
        pnl,
        newAvailable,
        tradeId,
      ]
    );

    await client.query('DELETE FROM positions WHERE id = $1', [positionId]);
    await client.query('COMMIT');

    return NextResponse.json({
      closed: true,
      realizedPnl: pnl,
      exitPrice: currentPrice,
      updatedBalance: {
        total: newMock,
        available: newAvailable,
        locked: newLocked,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to close position', err);
    return NextResponse.json({ error: 'Failed to close position' }, { status: 500 });
  } finally {
    await client.end();
  }
}
