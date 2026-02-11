# Paper Dex

Paper Dex is a DEX-style trading exchange for practicing execution with live prices.

Paper DEX is built on live Hyperliquid price feeds.
Connect your wallet, trade with mock USDC, and test strategies without risking real funds. Prices are streamed in real time via the Hyperliquid WebSocket so you're trading against actual market conditions, not simulations.

Features:

Live orderbook and price feeds from Hyperliquid
Full order management, limit, market, stop loss
Position tracking with real time PnL / order position
Persistent trade history via PostgreSQL
Wallet-based auth for sign in / sign up with signature only, no transactions (similar to lighter.xyz)

## Features

- Live order book + trades streaming
- Real-time chart with candle history from Postgres
- Wallet auth with signed message (nonce + JWT)
- Paper trading engine:
  - Market and limit orders
  - Optional stoploss attachment
  - Position tracking with liquidation prices
- Portfolio state:
  - Mock USDC total / available / locked balance
  - Open positions, open orders, trade history
- Failure-state UX:
  - Reconnecting banner
  - Stale/no feed handling
  - Disabled order form when price feed is unavailable
- Health endpoint for background services

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL (`pg`)
- Hyperliquid WebSocket (live market data)
- Ethers v6 (wallet signature verification)

## Architecture

### Frontend App

- Main trading UI lives in `app/page.tsx`.
- Uses live websocket (`hooks/useWebSocket.tsx`) or mock feed (`hooks/useMockWebSocket.tsx`) based on `NEXT_PUBLIC_WS_SOURCE`.
- Order book/trades can be persisted through API routes for snapshots/testing.

### Background Services (Node runtime)

Started from `instrumentation.ts` -> `services/index.ts` when runtime is Node.js:

1. `HyperliquidWebSocketService` (`services/websocketService.ts`)
   - Subscribes to live trade streams.
2. `CandleAggregator` (`services/candleAggregator.ts`)
   - Aggregates live trades into 1m candles.
   - Flushes candles to Postgres on interval/buffer/shutdown.
3. `LiquidationService` (`services/liquidationService.ts`)
   - Periodically checks open positions against mark price.
   - Handles liquidation and balance updates.

### Data Modes

- `NEXT_PUBLIC_WS_SOURCE=live`
  - Frontend uses live feed.
  - Background live ingestion + candle writes run.
- `NEXT_PUBLIC_WS_SOURCE=mock` (default)
  - Frontend uses mock generator.
  - Live ingestion is disabled.
  - Mock trades/orderbook can still be stored via API.

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 14+ (or compatible)
- Browser wallet extension (MetaMask or compatible EIP-1193 provider)

## Project Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
# App mode: live or mock
NEXT_PUBLIC_WS_SOURCE=live

# Required for auth token signing
JWT_SECRET=replace_with_a_long_random_secret

# Postgres connection (defaults shown)
PGHOST=localhost
PGPORT=5432
PGUSER=gm
PGDATABASE=fakeprices
PGPASSWORD=

# Optional pool tuning
PG_POOL_MAX=20
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECT_TIMEOUT_MS=5000

# Optional live ingestion config
WS_SYMBOLS=BTC,ETH,SOL,ARB
CANDLE_FLUSH_INTERVAL_MS=5000

# Optional: required only for /api/cron/cleanup-candles
CRON_SECRET=replace_with_random_cron_secret
```

3. Create database (if needed):

```bash
createdb -h localhost -U gm fakeprices
```

4. Apply schema:

```bash
psql -h localhost -U gm -d fakeprices -f scripts/psql_schema.sql
```

5. Start the app:

```bash
npm run dev
```

6. Open:

- `http://localhost:3000`

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_WS_SOURCE` | No | `mock` | Frontend feed source and live-ingestion toggle (`mock` or `live`) |
| `JWT_SECRET` | Yes | - | Signs/verifies auth JWT |
| `PGHOST` | No | `localhost` | Postgres host |
| `PGPORT` | No | `5432` | Postgres port |
| `PGUSER` | No | `gm` | Postgres user |
| `PGDATABASE` | No | `fakeprices` | Postgres database |
| `PGPASSWORD` | Sometimes | empty | Postgres password (if your DB requires one) |
| `PG_POOL_MAX` | No | `20` | Postgres pool max connections |
| `PG_IDLE_TIMEOUT_MS` | No | `30000` | Pool idle timeout |
| `PG_CONNECT_TIMEOUT_MS` | No | `5000` | Pool connection timeout |
| `WS_SYMBOLS` | No | `BTC,ETH,SOL,ARB` | Live ingestion symbols list |
| `CANDLE_FLUSH_INTERVAL_MS` | No | `5000` | Candle flush interval |
| `CRON_SECRET` | Only for cleanup route | - | Protects `/api/cron/cleanup-candles` |

## Database Schema (High Level)

Schema file: `scripts/psql_schema.sql`

Core tables:

- Market data:
  - `trades`
  - `orderbook_snapshots`
  - `candles`
- Paper trading:
  - `users`
  - `positions`
  - `paper_orders`
  - `paper_trades`
  - `balance_history`

## Useful Endpoints

- `GET /api/health`
  - Service status and websocket/aggregator/liquidation stats.
- `GET /api/candles?symbol=BTC&interval=5m&limit=500`
  - Returns candles (aggregates from stored 1m rows).
- `GET /api/trades?symbol=BTC&limit=50&source=live`
- `GET /api/orderbook?symbol=BTC&source=live`

Auth flow:

- `POST /api/auth/nonce`
- `POST /api/auth/verify`
- `GET /api/auth/me`

Paper trading routes:

- `GET/POST /api/orders`
- `POST /api/orders/match`
- `POST /api/orders/cancel`
- `GET /api/positions`
- `GET /api/positions/open`
- `POST /api/positions/close`
- `GET /api/positions/trades`

Optional maintenance:

- `GET /api/cron/cleanup-candles` (requires `Authorization: Bearer <CRON_SECRET>`)

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - run ESLint

## Key Files

- `app/page.tsx` - main trading UI
- `hooks/useWebSocket.tsx` - live market feed subscription
- `hooks/useMockWebSocket.tsx` - mock stream generator
- `services/index.ts` - background service bootstrap
- `services/websocketService.ts` - Hyperliquid trade ingestion
- `services/candleAggregator.ts` - 1m candle aggregation and DB flush
- `services/liquidationService.ts` - liquidation loop
- `app/api/*` - REST API routes
- `scripts/psql_schema.sql` - DB schema

## Troubleshooting

- `JWT_SECRET is not set`
  - Add `JWT_SECRET` in `.env.local` and restart server.
- Database connection errors
  - Verify `PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD` and that Postgres is running.
- No live data
  - Set `NEXT_PUBLIC_WS_SOURCE=live` and confirm outbound websocket access.
- Wallet connect says MetaMask not detected
  - Install/enable MetaMask (or compatible provider) and refresh.
- Health check shows `not_started`
  - Background services start only in Node runtime.

## Safety Note

Paper Dex is for simulation only. It uses mock USDC and does not place real on-chain trades.
