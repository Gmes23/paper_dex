# Hyperliquid Order Book Widget

A real-time cryptocurrency order book and trades viewer for Hyperliquid exchange, built with Next.js and TypeScript.

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