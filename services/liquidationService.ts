import { createPgClient, type PgClientLike } from '@/lib/pgClient';

type OpenPosition = {
  id: number;
  user_id: number;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  position_size: number;
  margin: number;
  leverage: number;
  liquidation_price: number;
  opened_at: string;
};

export type LiquidationServiceHandle = {
  stop: () => void;
  getStats: () => {
    running: boolean;
    inflight: boolean;
    lastTickAt: number | null;
    intervalMs: number;
  };
};

async function getMarkPrice(client: PgClientLike, symbol: string) {
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
      if (Number.isFinite(bestBid) && Number.isFinite(bestAsk)) {
        return (Number(bestBid) + Number(bestAsk)) / 2;
      }
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

async function liquidatePosition(client: PgClientLike, position: OpenPosition, mark: number) {
  let txStarted = false;

  try {
    await client.query('BEGIN');
    txStarted = true;

    const posRes = await client.query(
      `
      SELECT id
      FROM positions
      WHERE id = $1
      FOR UPDATE
      `,
      [position.id]
    );

    if (posRes.rows.length === 0) {
      await client.query('ROLLBACK');
      txStarted = false;
      return;
    }

    const userRes = await client.query(
      `
      SELECT mock_usdc_balance, locked_margin, available_balance
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [position.user_id]
    );

    const user = userRes.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      txStarted = false;
      return;
    }

    const margin = Number(position.margin);
    const newMock = Number(user.mock_usdc_balance) - margin;
    const newLocked = Number(user.locked_margin) - margin;
    const newAvailable = Number(user.available_balance);

    await client.query(
      `
      UPDATE users
      SET mock_usdc_balance = $1,
          locked_margin = $2,
          available_balance = $3
      WHERE id = $4
      `,
      [newMock, newLocked, newAvailable, position.user_id]
    );

    const tradeRes = await client.query(
      `
      INSERT INTO paper_trades (
        user_id, symbol, side, entry_price, exit_price, position_size, margin, leverage,
        realized_pnl, status, opened_at, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'liquidated', $10, NOW())
      RETURNING id
      `,
      [
        position.user_id,
        position.symbol,
        position.side,
        Number(position.entry_price),
        mark,
        Number(position.position_size),
        margin,
        Number(position.leverage),
        -margin,
        position.opened_at,
      ]
    );

    const tradeId = tradeRes.rows[0]?.id ?? null;

    await client.query(
      `
      INSERT INTO balance_history (user_id, change_type, amount, balance_after, trade_id, timestamp)
      VALUES ($1, 'liquidation', $2, $3, $4, NOW())
      `,
      [position.user_id, -margin, newAvailable, tradeId]
    );

    await client.query('DELETE FROM positions WHERE id = $1', [position.id]);
    await client.query('COMMIT');
    txStarted = false;

    console.log('[Liquidation] Position liquidated', {
      positionId: position.id,
      symbol: position.symbol,
      mark,
    });
  } catch (err) {
    if (txStarted) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    throw err;
  }
}

async function runLiquidationTick() {
  const client = createPgClient();
  await client.connect();

  try {
    const res = await client.query<OpenPosition>(`
      SELECT id, user_id, symbol, side, entry_price, position_size, margin, leverage, liquidation_price, opened_at
      FROM positions
    `);

    if (res.rows.length === 0) return;

    const markPriceCache = new Map<string, number | null>();
    for (const position of res.rows) {
      const symbol = position.symbol;
      if (!markPriceCache.has(symbol)) {
        markPriceCache.set(symbol, await getMarkPrice(client, symbol));
      }

      const mark = markPriceCache.get(symbol);
      if (!mark) continue;

      const liqHit =
        position.side === 'long'
          ? mark <= Number(position.liquidation_price)
          : mark >= Number(position.liquidation_price);

      if (!liqHit) continue;

      await liquidatePosition(client, position, mark);
    }
  } finally {
    await client.end();
  }
}

export function startLiquidationService(intervalMs = 5000): LiquidationServiceHandle {
  console.log('[Liquidation] Service started');

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let inflight = false;
  let lastTickAt: number | null = null;

  const runTick = async () => {
    if (stopped || inflight) return;
    inflight = true;
    lastTickAt = Date.now();

    try {
      await runLiquidationTick();
    } catch (err) {
      console.error('[Liquidation] Failed', err);
    } finally {
      inflight = false;
    }
  };

  timer = setInterval(() => {
    void runTick();
  }, intervalMs);
  void runTick();

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    getStats: () => ({
      running: !stopped,
      inflight,
      lastTickAt,
      intervalMs,
    }),
  };
}
