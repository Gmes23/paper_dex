import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

const SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'ARB']);
const ORDER_TYPES = new Set(['market', 'limit']);
const ORDER_STATUSES = new Set(['open', 'filled', 'canceled', 'rejected']);

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

function mapOrder(row: Record<string, unknown>) {
  return {
    id: Number(row.id as number | string),
    symbol: String(row.symbol ?? ''),
    side: String(row.side ?? ''),
    orderType: String(row.order_type ?? ''),
    status: String(row.status ?? ''),
    positionSize: Number(row.position_size as number | string),
    leverage: Number(row.leverage as number | string),
    reduceOnly: Boolean(row.reduce_only),
    limitPrice: row.limit_price == null ? null : Number(row.limit_price as number | string),
    stopPrice: row.stop_price == null ? null : Number(row.stop_price as number | string),
    attachedStopLossPrice: row.attached_stop_loss_price == null ? null : Number(row.attached_stop_loss_price as number | string),
    marginReserved: Number(row.margin_reserved as number | string),
    linkedPositionId: row.linked_position_id == null ? null : Number(row.linked_position_id as number | string),
    filledPrice: row.filled_price == null ? null : Number(row.filled_price as number | string),
    rejectReason: row.reject_reason == null ? null : String(row.reject_reason),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    filledAt: row.filled_at == null ? null : String(row.filled_at),
  };
}

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
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase();
  const status = (searchParams.get('status') ?? 'open').toLowerCase();
  const rawLimit = Number(searchParams.get('limit') ?? 200);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200;

  if (!ORDER_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (symbol && !SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    const params: Array<number | string> = [payload.sub, status, limit];
    const symbolClause = symbol ? 'AND symbol = $4' : '';
    if (symbol) params.push(symbol);

    const res = await client.query(
      `
      SELECT id, symbol, side, order_type, status, position_size, leverage, reduce_only,
             limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
             filled_price, reject_reason, created_at, updated_at, filled_at
      FROM paper_orders
      WHERE user_id = $1
        AND status = $2
        ${symbolClause}
      ORDER BY created_at DESC
      LIMIT $3
      `,
      params
    );

    return NextResponse.json({ orders: res.rows.map(mapOrder) });
  } finally {
    await client.end();
  }
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
  const orderType = typeof body?.orderType === 'string' ? body.orderType.toLowerCase() : '';
  const positionSize = Number(body?.positionSize);
  const leverage = Number(body?.leverage);
  const limitPrice = body?.limitPrice == null ? null : Number(body.limitPrice);
  const stopLossPrice = body?.stopLossPrice == null ? null : Number(body.stopLossPrice);

  if (!SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 });
  }
  if (!ORDER_TYPES.has(orderType)) {
    return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
  }
  if (!Number.isFinite(positionSize) || positionSize < 10) {
    return NextResponse.json({ error: 'Minimum position size is $10' }, { status: 400 });
  }
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 10) {
    return NextResponse.json({ error: 'Invalid leverage' }, { status: 400 });
  }
  if (orderType === 'limit' && (!Number.isFinite(limitPrice) || Number(limitPrice) <= 0)) {
    return NextResponse.json({ error: 'Limit price is required for limit orders' }, { status: 400 });
  }
  if (stopLossPrice != null && (!Number.isFinite(stopLossPrice) || Number(stopLossPrice) <= 0)) {
    return NextResponse.json({ error: 'Invalid stop loss price' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
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
    const margin = positionSize / leverage;
    const available = Number(user.available_balance);

    if (margin > available) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Insufficient balance. Required: ${margin.toFixed(2)}, Available: ${available.toFixed(2)}`,
      }, { status: 400 });
    }

    if (orderType === 'limit') {
      const entryReference = Number(limitPrice);
      const placementMarketPrice = await getMarketPrice(client, symbol, side);
      if (!placementMarketPrice) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Market data unavailable' }, { status: 503 });
      }

      const hasValidDirection = side === 'long'
        ? entryReference < placementMarketPrice
        : entryReference > placementMarketPrice;
      if (!hasValidDirection) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: side === 'long'
            ? 'Long limit price must be below current market price'
            : 'Short limit price must be above current market price',
        }, { status: 400 });
      }

      if (stopLossPrice != null) {
        const validStop =
          side === 'long' ? stopLossPrice < entryReference : stopLossPrice > entryReference;
        if (!validStop) {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: side === 'long'
              ? 'For long orders, stop loss must be below entry price'
              : 'For short orders, stop loss must be above entry price',
          }, { status: 400 });
        }
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

      const orderRes = await client.query(
        `
        INSERT INTO paper_orders (
          user_id, symbol, side, order_type, status, position_size, leverage, reduce_only,
          limit_price, stop_price, attached_stop_loss_price, margin_reserved, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'limit', 'open', $4, $5, FALSE, $6, NULL, $7, $8, NOW(), NOW())
        RETURNING id, symbol, side, order_type, status, position_size, leverage, reduce_only,
                  limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
                  filled_price, reject_reason, created_at, updated_at, filled_at
        `,
        [payload.sub, symbol, side, positionSize, leverage, limitPrice, stopLossPrice, margin]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        order: mapOrder(orderRes.rows[0]),
        updatedBalance: {
          total: Number(user.mock_usdc_balance),
          available: newAvailable,
          locked: newLocked,
        },
      });
    }

    const marketPrice = await getMarketPrice(client, symbol, side);
    if (!marketPrice) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Market data unavailable' }, { status: 503 });
    }

    if (stopLossPrice != null) {
      const validStop = side === 'long' ? stopLossPrice < marketPrice : stopLossPrice > marketPrice;
      if (!validStop) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: side === 'long'
            ? 'For long orders, stop loss must be below entry price'
            : 'For short orders, stop loss must be above entry price',
        }, { status: 400 });
      }
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

    const liquidationPrice = getLiquidationPrice(marketPrice, leverage, side);

    const posRes = await client.query(
      `
      INSERT INTO positions (
        user_id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, unrealized_pnl, opened_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
      RETURNING id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, unrealized_pnl, opened_at
      `,
      [payload.sub, symbol, side, marketPrice, positionSize, margin, leverage, liquidationPrice]
    );

    const position = posRes.rows[0];

    const orderRes = await client.query(
      `
      INSERT INTO paper_orders (
        user_id, symbol, side, order_type, status, position_size, leverage, reduce_only,
        limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
        filled_price, created_at, updated_at, filled_at
      )
      VALUES ($1, $2, $3, 'market', 'filled', $4, $5, FALSE, NULL, NULL, NULL, 0, $6, $7, NOW(), NOW(), NOW())
      RETURNING id, symbol, side, order_type, status, position_size, leverage, reduce_only,
                limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
                filled_price, reject_reason, created_at, updated_at, filled_at
      `,
      [payload.sub, symbol, side, positionSize, leverage, position.id, marketPrice]
    );

    if (stopLossPrice != null) {
      await client.query(
        `
        INSERT INTO paper_orders (
          user_id, symbol, side, order_type, status, position_size, leverage, reduce_only,
          stop_price, margin_reserved, linked_position_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'stop_market', 'open', $4, $5, TRUE, $6, 0, $7, NOW(), NOW())
        `,
        [payload.sub, symbol, side, positionSize, leverage, stopLossPrice, position.id]
      );
    }

    await client.query(
      `
      INSERT INTO balance_history (user_id, change_type, amount, balance_after, timestamp)
      VALUES ($1, 'position_opened', $2, $3, NOW())
      `,
      [payload.sub, -margin, newAvailable]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      order: mapOrder(orderRes.rows[0]),
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
    console.error('Failed to place order', err);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  } finally {
    await client.end();
  }
}
