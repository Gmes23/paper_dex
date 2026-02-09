import { NextResponse } from 'next/server';
import { createPgClient } from '@/lib/pgClient';
import { getAuthTokenFromRequest, verifyJwt } from '@/lib/auth';

function getLiquidationPrice(entry: number, leverage: number, side: 'long' | 'short') {
  const factor = 1 / leverage;
  return side === 'long' ? entry * (1 - factor) : entry * (1 + factor);
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
  const markPrice = Number(body?.markPrice);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    return NextResponse.json({ error: 'Invalid mark price' }, { status: 400 });
  }

  const client = createPgClient();
  await client.connect();

  try {
    await client.query('BEGIN');

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

    let mockBalance = Number(userRes.rows[0].mock_usdc_balance);
    let lockedMargin = Number(userRes.rows[0].locked_margin);
    let availableBalance = Number(userRes.rows[0].available_balance);

    const ordersRes = await client.query(
      `
      SELECT id, symbol, side, order_type, status, position_size, leverage, reduce_only,
             limit_price, stop_price, attached_stop_loss_price, margin_reserved, linked_position_id
      FROM paper_orders
      WHERE user_id = $1
        AND symbol = $2
        AND status = 'open'
      ORDER BY created_at ASC
      FOR UPDATE
      `,
      [payload.sub, symbol]
    );

    let filledCount = 0;
    let triggeredStops = 0;
    let rejectedCount = 0;
    let liquidatedCount = 0;

    for (const order of ordersRes.rows) {
      if (order.order_type === 'limit') {
        const limitPrice = Number(order.limit_price);
        if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
          const marginReserved = Number(order.margin_reserved);
          if (marginReserved > 0) {
            availableBalance += marginReserved;
            lockedMargin = Math.max(0, lockedMargin - marginReserved);
          }
          await client.query(
            `
            UPDATE paper_orders
            SET status = 'rejected',
                reject_reason = 'Invalid limit price',
                updated_at = NOW()
            WHERE id = $1
            `,
            [order.id]
          );
          rejectedCount += 1;
          continue;
        }

        const shouldFill = order.side === 'long' ? markPrice <= limitPrice : markPrice >= limitPrice;
        if (!shouldFill) continue;

        const existingPosRes = await client.query(
          `
          SELECT id
          FROM positions
          WHERE user_id = $1 AND symbol = $2 AND side = $3
          LIMIT 1
          FOR UPDATE
          `,
          [payload.sub, order.symbol, order.side]
        );

        if (existingPosRes.rows.length > 0) {
          const marginReserved = Number(order.margin_reserved);
          availableBalance += marginReserved;
          lockedMargin = Math.max(0, lockedMargin - marginReserved);
          await client.query(
            `
            UPDATE paper_orders
            SET status = 'rejected',
                reject_reason = 'Position already open for symbol/side',
                updated_at = NOW()
            WHERE id = $1
            `,
            [order.id]
          );
          rejectedCount += 1;
          continue;
        }

        const positionSize = Number(order.position_size);
        const leverage = Number(order.leverage);
        const marginReserved = Number(order.margin_reserved);
        const liquidationPrice = getLiquidationPrice(limitPrice, leverage, order.side);

        const posRes = await client.query(
          `
          INSERT INTO positions (
            user_id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, unrealized_pnl, opened_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
          RETURNING id
          `,
          [payload.sub, order.symbol, order.side, limitPrice, positionSize, marginReserved, leverage, liquidationPrice]
        );

        const positionId = Number(posRes.rows[0].id);

        await client.query(
          `
          UPDATE paper_orders
          SET status = 'filled',
              linked_position_id = $2,
              filled_price = $3,
              filled_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          `,
          [order.id, positionId, limitPrice]
        );

        const attachedStop = Number(order.attached_stop_loss_price);
        if (Number.isFinite(attachedStop) && attachedStop > 0) {
          await client.query(
            `
            INSERT INTO paper_orders (
              user_id, symbol, side, order_type, status, position_size, leverage, reduce_only,
              stop_price, margin_reserved, linked_position_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, 'stop_market', 'open', $4, $5, TRUE, $6, 0, $7, NOW(), NOW())
            `,
            [payload.sub, order.symbol, order.side, positionSize, leverage, attachedStop, positionId]
          );
        }

        filledCount += 1;
        continue;
      }

      if (order.order_type !== 'stop_market') continue;

      const stopPrice = Number(order.stop_price);
      const linkedPositionId = Number(order.linked_position_id);
      if (!Number.isFinite(stopPrice) || stopPrice <= 0 || !Number.isFinite(linkedPositionId)) {
        await client.query(
          `
          UPDATE paper_orders
          SET status = 'rejected',
              reject_reason = 'Invalid stop order configuration',
              updated_at = NOW()
          WHERE id = $1
          `,
          [order.id]
        );
        rejectedCount += 1;
        continue;
      }

      const posRes = await client.query(
        `
        SELECT id, symbol, side, entry_price, position_size, margin, leverage, opened_at
        FROM positions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        `,
        [linkedPositionId, payload.sub]
      );

      if (posRes.rows.length === 0) {
        await client.query(
          `
          UPDATE paper_orders
          SET status = 'canceled',
              reject_reason = 'Linked position no longer exists',
              updated_at = NOW()
          WHERE id = $1
          `,
          [order.id]
        );
        continue;
      }

      const position = posRes.rows[0];
      const shouldTrigger = position.side === 'long' ? markPrice <= stopPrice : markPrice >= stopPrice;
      if (!shouldTrigger) continue;

      const entryPrice = Number(position.entry_price);
      const size = Number(position.position_size);
      const margin = Number(position.margin);
      const isLong = position.side === 'long';
      const pnl = ((markPrice - entryPrice) / entryPrice) * size * (isLong ? 1 : -1);

      const availableAfterRelease = availableBalance + margin;
      const availableAfterPnl = availableAfterRelease + pnl;

      lockedMargin = Math.max(0, lockedMargin - margin);
      availableBalance = availableAfterPnl;
      mockBalance += pnl;

      const tradeRes = await client.query(
        `
        INSERT INTO paper_trades (
          user_id, symbol, side, entry_price, exit_price, position_size, margin, leverage,
          realized_pnl, status, opened_at, closed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'liquidated', $10, NOW())
        RETURNING id
        `,
        [
          payload.sub,
          position.symbol,
          position.side,
          entryPrice,
          markPrice,
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
          availableAfterPnl,
          tradeId,
        ]
      );

      await client.query('DELETE FROM positions WHERE id = $1', [position.id]);

      await client.query(
        `
        UPDATE paper_orders
        SET status = 'filled',
            filled_price = $2,
            filled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [order.id, markPrice]
      );

      await client.query(
        `
        UPDATE paper_orders
        SET status = 'canceled',
            reject_reason = 'Position closed by stop trigger',
            updated_at = NOW()
        WHERE linked_position_id = $1
          AND order_type = 'stop_market'
          AND status = 'open'
          AND id <> $2
        `,
        [position.id, order.id]
      );

      triggeredStops += 1;
      filledCount += 1;
    }

    const positionsRes = await client.query(
      `
      SELECT id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, opened_at
      FROM positions
      WHERE user_id = $1
        AND symbol = $2
      FOR UPDATE
      `,
      [payload.sub, symbol]
    );

    for (const position of positionsRes.rows) {
      const liquidationPrice = Number(position.liquidation_price);
      if (!Number.isFinite(liquidationPrice) || liquidationPrice <= 0) continue;

      const shouldLiquidate = position.side === 'long'
        ? markPrice <= liquidationPrice
        : markPrice >= liquidationPrice;
      if (!shouldLiquidate) continue;

      const size = Number(position.position_size);
      const margin = Number(position.margin);
      const pnl = -Math.abs(margin);
      const availableAfterRelease = availableBalance + margin;
      const availableAfterLiquidation = availableAfterRelease + pnl;

      lockedMargin = Math.max(0, lockedMargin - margin);
      availableBalance = availableAfterLiquidation;
      mockBalance += pnl;

      const tradeRes = await client.query(
        `
        INSERT INTO paper_trades (
          user_id, symbol, side, entry_price, exit_price, position_size, margin, leverage,
          realized_pnl, status, opened_at, closed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'liquidated', $10, NOW())
        RETURNING id
        `,
        [
          payload.sub,
          position.symbol,
          position.side,
          Number(position.entry_price),
          liquidationPrice,
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
        VALUES ($1, 'liquidation', $2, $3, $4, NOW())
        `,
        [payload.sub, pnl, availableAfterLiquidation, tradeId]
      );

      await client.query('DELETE FROM positions WHERE id = $1', [position.id]);
      await client.query(
        `
        UPDATE paper_orders
        SET status = 'canceled',
            reject_reason = 'Position liquidated',
            updated_at = NOW()
        WHERE user_id = $1
          AND linked_position_id = $2
          AND order_type = 'stop_market'
          AND status = 'open'
        `,
        [payload.sub, position.id]
      );

      liquidatedCount += 1;
    }

    await client.query(
      `
      UPDATE users
      SET mock_usdc_balance = $1,
          locked_margin = $2,
          available_balance = $3
      WHERE id = $4
      `,
      [mockBalance, lockedMargin, availableBalance, payload.sub]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      matched: filledCount,
      triggeredStops,
      liquidated: liquidatedCount,
      rejected: rejectedCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to match orders', err);
    return NextResponse.json({ error: 'Failed to match orders' }, { status: 500 });
  } finally {
    await client.end();
  }
}
