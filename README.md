# Hyperliquid Order Book Widget

================================================================================
HYPERLIQUID ORDER BOOK WIDGET - HOW IT WORKS (SIMPLE OVERVIEW)
================================================================================

This project has two parallel data flows:

1. Mock/Test Flow (for `/test-chart`)
2. Live Production Flow (Hyperliquid WebSocket → DB → Chart)

Both flows can run without breaking each other.

================================================================================
ARCHITECTURE SUMMARY
================================================================================

FRONTEND (Next.js UI)
--------------------
- Displays orderbook, trades, chart, and positions.
- NEVER writes candles to DB in production.
- Fetches historical candles from `/api/candles`.
- Uses WebSocket trades only for visual, real-time candle updates.

BACKEND (Background Service)
----------------------------
- Connects directly to Hyperliquid WebSocket.
- Aggregates trades into 1-minute candles in memory.
- Flushes candles to Postgres every 5 seconds (UPSERT).
- Runs continuously when the app starts in Node runtime.

================================================================================
DATA FLOW (LIVE PRODUCTION)
================================================================================

Hyperliquid WebSocket
  ↓
Backend Service (Node)
  - receives trades
  - aggregates 1m candles in memory
  - flushes to Postgres every 5s
  ↓
PostgreSQL `candles` table
  ↓
Frontend `/api/candles`
  - fetches 1m candles
  - aggregates to 5m/15m/1h on-demand
  ↓
Chart renders historical + live updates

================================================================================
DATA FLOW (MOCK / TEST)
================================================================================

Mock WebSocket (Frontend only)
  ↓
Frontend POST `/api/trades`
  - saves mock trades
  - builds mock 1m candles (test only)
  ↓
PostgreSQL `candles` table
  ↓
Frontend `/api/candles`
  ↓
Chart renders historical + live updates

================================================================================
WHAT THE BACKEND SAVES
================================================================================

Table: `candles`
Each row = 1 minute bucket per symbol.

Columns:
- symbol (BTC, ETH, SOL, etc.)
- interval = '1m' only (stored)
- time = epoch seconds (bucket start)
- open, high, low, close, volume

When a new coin is added to the WebSocket symbols list, it starts writing
new candle rows automatically (no extra table required).

================================================================================
HOW THE FRONTEND LOADS DATA
================================================================================

1. Page loads:
   - `useChartData` calls `/api/candles?symbol=BTC&interval=5m&limit=500`
2. API reads 1m candles and aggregates to requested interval.
3. Chart renders historical data.
4. Live trades update the current visible candle only (visual).
5. Completed candles are always sourced from the database.

================================================================================
IMPORTANT FILES (LIVE PIPELINE)
================================================================================

- `services/websocketService.ts`
  - Connects to Hyperliquid WebSocket.
  - Feeds trades into aggregator.

- `services/candleAggregator.ts`
  - Builds 1m candles in memory.
  - Flushes to DB every 5s with UPSERT.

- `services/index.ts`
  - Starts background services.

- `instrumentation.ts`
  - Auto-starts services on app launch (Node runtime only).

- `app/api/candles/route.ts`
  - Reads 1m candles from DB.
  - Aggregates to 5m/15m/1h on demand.

================================================================================
IMPORTANT FILES (MOCK / TEST PIPELINE)
================================================================================

- `hooks/useMockWebSocket.tsx`
  - Frontend mock trades generator.

- `app/api/trades/route.ts`
  - Persists mock trades.
  - Builds 1m candles (test only).

- `/test-chart`
  - Test page for mock flow.

================================================================================
KEY RULES
================================================================================

- Frontend NEVER writes candles in production.
- Backend writes candles continuously (live WebSocket).
- Mock flow still works for testing.
- Charts always read historical candles from the DB.

## Demo

Check out the live application: [https://hyperliquid-orderbook-ws.vercel.app](https://hyperliquid-orderbook-ws.vercel.app)

## Features

- **Real-time WebSocket Data**: Live order book and trade updates
- **Multiple Assets**: Support for BTC and ETH perpetual contracts
- **Price Grouping**: Adjustable price level aggregation (1, 2, 5, 10 for BTC / 0.1, 0.2, 0.5, 1 for ETH)
- **Denomination Toggle**: View sizes in asset amount or USDC value
- **Depth Visualization**: Visual bars showing cumulative order book depth
- **Flash Animations**: Price level changes highlighted with smooth animations
- **Trades View**: Real-time trade feed with buy/sell indicators
- **Responsive Design**: Clean, dark-themed UI optimized for mobile

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **WebSocket**: Native WebSocket API
- **State Management**: React Hooks

## Project Structure
```
hyperliquid_widget/
├── app/
│   ├── page.tsx                 # Main application component
│   ├── layout.tsx
│   └── globals.css              # Global styles and animations
├── components/
│   ├── OrderBook/
│   │   ├── OrderBookHeader.tsx  # Header with controls
│   │   ├── OrderBookTable.tsx   # Order book display
│   │   ├── OrderBookRow.tsx     # Individual order book row
│   │   ├── SpreadIndicator.tsx  # Bid-ask spread display
│   │   └── TradesTable.tsx      # Trades list display
│   └── ui/
│       ├── Dropdown.tsx         # Reusable dropdown component
│       └── TabSelector.tsx      # Tab switching component
├── hooks/
│   ├── useWebSocket.tsx         # WebSocket connection management
│   ├── useOrderBookState.tsx    # Order book state and aggregation
│   └── useTrades.tsx            # Trades state management
└── lib/
    ├── types.ts                 # TypeScript type definitions
    ├── constants.ts             # App constants
    ├── utils.ts                 # Utility functions
    └── orderbook.ts             # Order book aggregation logic
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hyperliquid_widget
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Setup (Required)

Create a `.env.local` file at the project root with the following:

```bash
# Use live Hyperliquid websocket in the frontend
NEXT_PUBLIC_WS_SOURCE=live

# JWT secret for wallet auth (required)
JWT_SECRET=replace_with_long_random_string

# Symbols for the backend candle service (optional)
WS_SYMBOLS=BTC,ETH,SOL,ARB

# Candle flush interval (optional)
CANDLE_FLUSH_INTERVAL_MS=5000
```

Restart the dev server after editing `.env.local`.

## Database Setup (Required)

This project expects a PostgreSQL database. Defaults are defined in `lib/pgClient.ts`:

- `PGHOST` defaults to `localhost`
- `PGPORT` defaults to `5432`
- `PGUSER` defaults to `gm`
- `PGDATABASE` defaults to `fakeprices`
- `PGPASSWORD` must be provided if your DB requires a password

Apply the schema:

```bash
psql -h localhost -U gm -d fakeprices -f scripts/psql_schema.sql
```

If you use `DATABASE_URL`, set it in `.env.local` or your shell.

## Running the App

```bash
npm run dev
```

You should see logs like:

- `[Services] Initializing background services...`
- `[WebSocket] Connected to Hyperliquid`
- `[Candle Aggregator] Flushed X candles to DB`

## Notes

- `/test-chart` uses the mock WebSocket and persists mock trades via `/api/trades`.
- Production candles are written by the backend WebSocket service (not the frontend).
- On Vercel (serverless), the background service will not run. Use Railway/Render/VPS for 24/7 ingestion.

## Key Components

### Hooks

**`useWebSocket`**
- Manages WebSocket connection to Hyperliquid API
- Handles subscriptions for order book and trades
- Auto-reconnects on disconnect

**`useOrderBookState`**
- Processes raw order book data
- Aggregates price levels based on grouping
- Tracks flash animations for new/updated levels
- Calculates spread and depth visualization

**`useTrades`**
- Processes incoming trades
- Maintains list of recent trades (max 50)
- Formats trade data for display

### Components

**`OrderBookHeader`**
- Asset selector (BTC/ETH)
- Price grouping dropdown
- Tab selector (Orders/Trades)
- Denomination toggle (Asset/USDC)
- Connection status indicator

**`OrderBookTable`**
- Displays asks (sell orders) at top
- Shows bid-ask spread
- Displays bids (buy orders) at bottom
- Visual depth bars showing cumulative size

**`TradesTable`**
- Scrollable list of recent trades
- Color-coded by side (green=buy, red=sell)
- Shows price, size, and timestamp

## API

The application connects to Hyperliquid's WebSocket API:

**Endpoint**: `wss://api.hyperliquid.xyz/ws`

**Subscriptions**:
- `l2Book` - Level 2 order book data
- `trades` - Recent trades

## Customization

### Price Grouping Options

Edit `lib/constants.ts`:
```typescript
export const BTC_GROUP_OPTIONS = [1, 2, 5, 10];
export const ETH_GROUP_OPTIONS = [0.1, 0.2, 0.5, 1];
```

### Number of Rows
```typescript
export const NUM_ROWS = 15; // Rows displayed per side
```

### Styling

Modify Tailwind classes in components or add custom CSS in `app/globals.css`

## Performance Optimizations

- `useMemo` for expensive calculations
- `useCallback` for stable function references
- Fixed row rendering to prevent layout shifts
- Efficient price aggregation algorithm
- Debounced flash animations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Known Issues

- WebSocket connection requires stable internet
- Large price groupings may hide some orders


## License

MIT


## Acknowledgments

- Hyperliquid for providing the WebSocket API
- Next.js team for the excellent framework
