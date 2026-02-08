import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

const SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'ARB']);

function getLiquidationPrice(entry: number, leverage: number, side: 'long' | 'short') {
  const factor = 1 / leverage;
  return side === 'long' ? entry * (1 - factor) : entry * (1 + factor);
}

async function getMarketPrice(client: ReturnType<typeof createPgClient>, symbol: string, side: 'long' | 'short') {
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
      if (side === 'long' && Number.isFinite(bestAsk)) return Number(bestAsk);
      if (side === 'short' && Number.isFinite(bestBid)) return Number(bestBid);
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
  const symbol = typeof body?.symbol === 'string' ? body.symbol.toUpperCase() : '';
  const side = body?.side === 'short' ? 'short' : 'long';
  const positionSize = Number(body?.positionSize);
  const leverage = Number(body?.leverage);

  if (!SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 });
  }
  if (!Number.isFinite(positionSize) || positionSize <= 0) {
    return NextResponse.json({ error: 'Invalid position size' }, { status: 400 });
  }
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 10) {
    return NextResponse.json({ error: 'Invalid leverage' }, { status: 400 });
  }
  if (positionSize < 10) {
    return NextResponse.json({ error: 'Minimum position size is $10' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    const entryPrice = await getMarketPrice(client, symbol, side);
    if (!entryPrice) {
      return NextResponse.json({ error: 'Market data unavailable' }, { status: 503 });
    }

    const margin = positionSize / leverage;
    const liquidationPrice = getLiquidationPrice(entryPrice, leverage, side);

    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT id
      FROM positions
      WHERE user_id = $1 AND symbol = $2 AND side = $3
      LIMIT 1
      `,
      [payload.sub, symbol, side]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Position already open for this symbol/side' }, { status: 400 });
    }

    const userRes = await client.query(
      `
      SELECT id, mock_usdc_balance, locked_margin, available_balance
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [payload.sub]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userRes.rows[0];
    const available = Number(user.available_balance);
    if (margin > available) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Insufficient balance. Required: ${margin.toFixed(2)}, Available: ${available.toFixed(2)}`,
      }, { status: 400 });
    }

    const newLocked = Number(user.locked_margin) + margin;
    const newAvailable = available - margin;

    await client.query(
      `
      UPDATE users
      SET locked_margin = $1,
          available_balance = $2
      WHERE id = $3
      `,
      [newLocked, newAvailable, payload.sub]
    );

    const posRes = await client.query(
      `
      INSERT INTO positions (
        user_id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, unrealized_pnl, opened_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
      RETURNING id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, unrealized_pnl, opened_at
      `,
      [payload.sub, symbol, side, entryPrice, positionSize, margin, leverage, liquidationPrice]
    );

    await client.query(
      `
      INSERT INTO balance_history (user_id, change_type, amount, balance_after, timestamp)
      VALUES ($1, 'position_opened', $2, $3, NOW())
      `,
      [payload.sub, -margin, newAvailable]
    );

    await client.query('COMMIT');

    const position = posRes.rows[0];

    return NextResponse.json({
      position: {
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        entryPrice: Number(position.entry_price),
        positionSize: Number(position.position_size),
        margin: Number(position.margin),
        leverage: Number(position.leverage),
        liquidationPrice: Number(position.liquidation_price),
        unrealizedPnl: Number(position.unrealized_pnl),
        openedAt: position.opened_at,
      },
      updatedBalance: {
        total: Number(user.mock_usdc_balance),
        available: newAvailable,
        locked: newLocked,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to open position', err);
    return NextResponse.json({ error: 'Failed to open position' }, { status: 500 });
  } finally {
    await client.end();
  }
}
