import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

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
  const orderId = Number(body?.orderId);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `
      SELECT id, user_id, symbol, side, order_type, status, position_size, leverage, reduce_only,
             limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
             filled_price, reject_reason, created_at, updated_at, filled_at
      FROM paper_orders
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [orderId, payload.sub]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];
    if (order.status !== 'open') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Only open orders can be canceled' }, { status: 400 });
    }

    const marginReserved = Number(order.margin_reserved);
    if (marginReserved > 0) {
      const userRes = await client.query(
        `
        SELECT mock_usdc_balance, locked_margin, available_balance
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
      const newLocked = Math.max(0, Number(user.locked_margin) - marginReserved);
      const newAvailable = Number(user.available_balance) + marginReserved;

      await client.query(
        `
        UPDATE users
        SET locked_margin = $1,
            available_balance = $2
        WHERE id = $3
        `,
        [newLocked, newAvailable, payload.sub]
      );
    }

    const updatedRes = await client.query(
      `
      UPDATE paper_orders
      SET status = 'canceled',
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, symbol, side, order_type, status, position_size, leverage, reduce_only,
                limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id,
                filled_price, reject_reason, created_at, updated_at, filled_at
      `,
      [orderId]
    );

    await client.query('COMMIT');
    return NextResponse.json({ order: mapOrder(updatedRes.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to cancel order', err);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  } finally {
    await client.end();
  }
}
