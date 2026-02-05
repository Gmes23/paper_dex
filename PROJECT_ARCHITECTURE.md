# Hyperliquid Order Book Widget - Complete Architecture Documentation

## Project Overview

A real-time cryptocurrency order book and trades visualization widget for Hyperliquid perpetuals. Built with Next.js 16, React 19, and Tailwind CSS. Displays live BTC/ETH order book data via WebSocket with dynamic price grouping, spread calculations, and recent trades history.

**Tech Stack:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- WebSocket (Hyperliquid API)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Hyperliquid WebSocket API                            │
│                    wss://api.hyperliquid.xyz/ws                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           useWebSocket Hook                                 │
│  - Establishes WebSocket connection                                         │
│  - Subscribes to l2Book (orderbook) and trades channels                     │
│  - Auto-reconnects on disconnect (3s delay)                                 │
│  - Parses JSON messages and dispatches to callbacks                         │
└───────────────┬─────────────────────────────────┬───────────────────────────┘
                │                                 │
                ▼                                 ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     useOrderBookState Hook    │   │        useTrades Hook         │
│  - Stores raw bids/asks       │   │  - Stores processed trades    │
│  - Aggregates by price group  │   │  - Formats time, price, size  │
│  - Calculates spread          │   │  - Manages unique IDs         │
│  - Tracks flash animations    │   │  - Limits to 50 trades        │
│  - Computes depth percentages │   │                               │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │
                └───────────────┬───────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           page.tsx (Main Page)                              │
│  - Orchestrates all state (symbol, grouping, tab, denomination)             │
│  - Renders OrderBookHeader + conditional table                              │
│  - Handles symbol changes and state resets                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
┌───────────────────┐  ┌────────────────┐  ┌───────────────────┐
│  OrderBookHeader  │  │ OrderBookTable │  │   TradesTable     │
│  - Symbol picker  │  │ - 2-col layout │  │ - Scrollable list │
│  - Tab selector   │  │ - Depth bars   │  │ - Dynamic heights │
│  - Denomination   │  │ - Flash anims  │  │ - Color-coded     │
│  - Connection dot │  │                │  │                   │
└───────────────────┘  └────────────────┘  └───────────────────┘
```

---

## Data Flow

1. **WebSocket Connection**: `useWebSocket` connects to Hyperliquid API
2. **Data Reception**: Raw orderbook levels and trades arrive via WebSocket
3. **Processing**:
   - Orderbook: `useOrderBookState` aggregates levels by price grouping
   - Trades: `useTrades` formats and prepends new trades
4. **State Updates**: React state triggers re-renders
5. **UI Rendering**: Components display processed data with visual indicators

---

## File Structure

```
hyperliquid_widget/
├── app/
│   ├── page.tsx          # Main OrderBook page (orchestrates everything)
│   └── layout.tsx        # Root layout (fonts, metadata)
├── components/
│   ├── ui/
│   │   ├── Dropdown.tsx      # Generic dropdown menu
│   │   └── TabSelector.tsx   # Tab switcher UI
│   └── OrderBook/
│       ├── OrderBookHeader.tsx   # Controls header
│       ├── OrderBookTable.tsx    # 2-column orderbook display
│       ├── OrderBookRow.tsx      # Single row with depth bar
│       ├── TradesTable.tsx       # Recent trades list
│       └── SpreadIndicator.tsx   # Bid-ask spread display
├── hooks/
│   ├── useWebSocket.tsx      # WebSocket connection management
│   ├── useOrderBookState.tsx # Orderbook state & aggregation
│   └── useTrades.tsx         # Trades list management
└── lib/
    ├── types.ts       # TypeScript interfaces
    ├── constants.ts   # API URL, options, limits
    ├── utils.ts       # Formatting utilities
    └── orderbook.ts   # Price quantization & level aggregation
```

---

# Types & Constants

## lib/types.ts

**Purpose**: Defines all TypeScript interfaces and type aliases used throughout the application.

**Key Types**:
- `OrderBookLevel`: Raw data from WebSocket (px, sz, n)
- `ProcessedLevel`: Aggregated level with computed values (cumulative totals, flash detection)
- `TradeData`: Raw trade from WebSocket
- `ProcessedTrade`: Formatted trade for display

```typescript
export interface OrderBookLevel {
    px: string;
    sz: string;
    n: number;
  }

  export interface OrderBookData {
    coin: string;
    levels: [OrderBookLevel[], OrderBookLevel[]];
    time: number;
  }

  export interface ProcessedLevel {
    price: number;
    size: number;
    sizeUsdc: number;
    total: number;
    totalUsdc: number;
    priceStr: string;
    isNew: boolean;
  }

  export interface TradeData {
    coin: string;
    side: string;
    px: string;
    sz: string;
    time: number;
    hash: string;
  }

  export interface ProcessedTrade {
    price: string;
    size: number;
    sizeUsdc: number;
    side: 'buy' | 'sell';
    time: string;
    id: string;
  }

  export type Symbol = 'BTC' | 'ETH';
  export type Tab = 'orderbook' | 'trades';
  export type Denomination = 'asset' | 'usdc';
```

---

## lib/constants.ts

**Purpose**: Centralized configuration values that control app behavior.

**Key Constants**:
- `BTC_GROUP_OPTIONS/ETH_GROUP_OPTIONS`: Price grouping levels per asset
- `NUM_ROWS`: Fixed number of rows to display (15 per side)
- `API_URL`: WebSocket endpoint
- `MAX_TRADES`: Maximum trades to keep in state
- `RECONNECT_DELAY`: Auto-reconnect timeout

```typescript
export const BTC_GROUP_OPTIONS = [1, 2, 5, 10];
export const ETH_GROUP_OPTIONS = [0.1, 0.2, 0.5, 1];
export const NUM_ROWS = 15;
export const API_URL = 'wss://api.hyperliquid.xyz/ws';
export const MAX_TRADES = 50;
export const RECONNECT_DELAY = 3000;
```

---

# Utility Functions

## lib/utils.ts

**Purpose**: Formatting and display helper functions used across components.

**Key Functions**:
- `quantizePrice`: Rounds prices to grouping intervals (floors for bids, ceils for asks)
- `formatGrouping`: Formats grouping value for display
- `formatSize`: Formats size with appropriate decimals (4 for asset, 2 for USDC)
- `formatTotal`: Formats cumulative totals with locale strings
- `getDenomLabel`: Returns display label based on denomination

```typescript
import type { Symbol, Denomination } from './types';

export const quantizePrice = (price: number, step: number, isBid: boolean): number => {
  if (step >= 1) {
    return isBid
      ? Math.floor(price / step) * step
      : Math.ceil(price / step) * step;
  }

  const factor = Math.round(1 / step);
  const ticks = price * factor;

  const qTicks = isBid
    ? Math.floor(ticks + 1e-9)
    : Math.ceil(ticks - 1e-9);

  return qTicks / factor;
};

export const formatGrouping = (value: number): string => {
  if (value >= 1) return value.toFixed(0);
  return value.toString();
};

export const formatSize = (
  assetSize: number,
  usdcSize: number,
  denomination: Denomination
): string => {
  if (denomination === 'asset') {
    return assetSize.toFixed(4);
  }
  return usdcSize.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatTotal = (
  assetTotal: number,
  usdcTotal: number,
  denomination: Denomination
): string => {
  if (denomination === 'asset') {
    return assetTotal.toFixed(4);
  }
  return usdcTotal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const getDenomLabel = (denomination: Denomination, symbol: Symbol): string => {
  return denomination === 'asset' ? symbol : 'USDC';
};
```

---

## lib/orderbook.ts

**Purpose**: Core business logic for price quantization and orderbook level aggregation.

**Key Function - `aggregateLevels`**:
- Groups raw orderbook levels into price buckets based on grouping parameter
- Calculates cumulative totals (running sum of sizes)
- Tracks "new" prices for flash animations (highlight new entries)
- Returns sorted, processed levels with pricing precision based on grouping
- Enables dynamic grouping without reconnecting WebSocket

**Architecture Decision**: Client-side grouping allows subscribing once with full precision (nSigFigs=null) and dynamically adjusting grouping without WebSocket reconnection, avoiding latency from repeatedly opening/closing connections.

```typescript
import type { OrderBookLevel, ProcessedLevel } from './types';


export function quantizePrice(price: number, step: number, isBid: boolean): number {
  if (step >= 1) {
    return isBid
      ? Math.floor(price / step) * step
      : Math.ceil(price / step) * step;
  }

  const factor = Math.round(1 / step);
  const ticks = price * factor;

  const qTicks = isBid
    ? Math.floor(ticks + 1e-9)
    : Math.ceil(ticks - 1e-9);

  return qTicks / factor;
}

/**
 * Aggregates orderbook levels into price buckets based on the grouping parameter.
 *
 * This client-side grouping approach allows us to:
 * 1. Subscribe once with full precision (nSigFigs=null)
 * 2. Dynamically adjust grouping without reconnecting the WebSocket
 * 3. Improve rendering performance by reducing the number of displayed rows
 * 4. Avoid latency from repeatedly opening/closing WebSocket connections
 *
 * @param levels - Raw orderbook levels from WebSocket
 * @param grouping - Price increment for bucketing (e.g., 0.01, 0.5, 1, 5)
 * @param isBids - Whether these are bid levels (affects rounding direction)
 * @param knownPrices - Set of previously seen prices for flash detection
 * @param shouldSkipFlash - Whether to skip flash animations (e.g., on initial load)
 * @returns Aggregated levels with cumulative totals and newly seen prices
 */
export function aggregateLevels(
  levels: OrderBookLevel[],
  grouping: number,
  isBids: boolean,
  knownPrices: Set<number>,
  shouldSkipFlash: boolean
): { levels: ProcessedLevel[], newKnownPrices: Set<number> } {
  const aggregated = new Map<number, { size: number; sizeUsdc: number }>();

  for (const level of levels) {
    const price = parseFloat(level.px);
    const size = parseFloat(level.sz);
    const sizeUsdc = size * price;

    const roundedPrice = quantizePrice(price, grouping, isBids);

    const existing = aggregated.get(roundedPrice) || { size: 0, sizeUsdc: 0 };
    aggregated.set(roundedPrice, {
      size: existing.size + size,
      sizeUsdc: existing.sizeUsdc + sizeUsdc,
    });
  }

  let entries = Array.from(aggregated.entries());
  entries.sort((a, b) => isBids ? b[0] - a[0] : a[0] - b[0]);

  const result: ProcessedLevel[] = [];
  let runningTotal = 0;
  let runningTotalUsdc = 0;
  const newKnownPrices = new Set<number>();

  const decimals = grouping >= 1 ? 0 : Math.abs(Math.floor(Math.log10(grouping)));

  for (const [price, { size, sizeUsdc }] of entries) {
    runningTotal += size;
    runningTotalUsdc += sizeUsdc;

    const isNew = !shouldSkipFlash && !knownPrices.has(price);
    newKnownPrices.add(price);

    result.push({
      price,
      size,
      sizeUsdc,
      total: runningTotal,
      totalUsdc: runningTotalUsdc,
      priceStr: price.toFixed(decimals),
      isNew,
    });
  }

  return { levels: result, newKnownPrices };
}
```

---

# Custom Hooks

## hooks/useWebSocket.tsx

**Purpose**: Manages WebSocket connection to Hyperliquid API with auto-reconnect.

**Responsibilities**:
- Establishes WebSocket connection with error handling
- Subscribes to `l2Book` (orderbook) and `trades` channels
- Parses incoming JSON messages and dispatches to callbacks
- Auto-reconnects on disconnect (3 second delay)
- Cleans up subscriptions and connection on unmount

**Architecture Pattern**: The hook abstracts WebSocket complexity, providing a clean interface that returns only `isConnected` status. Callbacks are used for data updates to avoid coupling.

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { API_URL, RECONNECT_DELAY } from '@/lib/constants';
import type { Symbol, OrderBookData, TradeData } from '@/lib/types';

interface UseWebSocketProps {
  symbol: Symbol;
  onOrderBookUpdate: (data: OrderBookData) => void;
  onTradesUpdate: (data: TradeData[]) => void;
}

export function useWebSocket({
  symbol,
  onOrderBookUpdate,
  onTradesUpdate
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    let ws: WebSocket;

    const connect = () => {
      try {
        ws = new WebSocket(API_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);

          // Subscribe to orderbook
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'l2Book',
              coin: symbol,
              nSigFigs: null,
            }
          }));

          // Subscribe to trades
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'trades',
              coin: symbol
            }
          }));

          console.log(`Subscribed to orderbook and trades for: ${symbol}`);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.channel === 'l2Book' && data.data) {
              onOrderBookUpdate(data.data);
            } else if (data.channel === 'trades' && data.data) {
              onTradesUpdate(data.data);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, RECONNECT_DELAY);
        };
      } catch (error) {
        console.error('Connection error:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'l2Book', coin: symbol }
        }));
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'trades', coin: symbol }
        }));
        ws.close();
      }
    };
  }, [symbol, onOrderBookUpdate, onTradesUpdate]);

  return { isConnected };
}
```

---

## hooks/useOrderBookState.tsx

**Purpose**: Maintains orderbook state, performs aggregation, and computes derived values.

**Key Responsibilities**:
- Stores raw bid/ask levels from WebSocket
- Aggregates levels using `aggregateLevels` based on price grouping
- Tracks known prices for flash animation detection
- Calculates bid-ask spread (value and percentage)
- Computes max cumulative totals for depth bar visualization
- Creates fixed-size arrays (NUM_ROWS=15) for consistent display

**Architecture Pattern**: Uses `useMemo` for expensive aggregation computations, `useCallback` for stable callback references, and `useRef` for mutable values that shouldn't trigger re-renders (known prices, flash skip flag).

```typescript
'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { OrderBookLevel, OrderBookData, ProcessedLevel, Symbol } from '@/lib/types';
import { aggregateLevels } from '@/lib/orderbook';
import { NUM_ROWS } from '@/lib/constants';

interface UseOrderBookStateProps {
  symbol: Symbol;
  priceGrouping: number;
}

export function useOrderBookState({ symbol, priceGrouping }: UseOrderBookStateProps) {
  const [rawBids, setRawBids] = useState<OrderBookLevel[]>([]);
  const [rawAsks, setRawAsks] = useState<OrderBookLevel[]>([]);

  const knownBidPricesRef = useRef<Set<number>>(new Set());
  const knownAskPricesRef = useRef<Set<number>>(new Set());

  const skipFlashRef = useRef<boolean>(true);
  const currentSymbolRef = useRef<string>(symbol);


  // Ref storing current symbol to prevent processing stale WebSocket messages after symbol changes
  useEffect(() => {
    currentSymbolRef.current = symbol;
    setRawBids([]);
    setRawAsks([]);
    knownBidPricesRef.current = new Set();
    knownAskPricesRef.current = new Set();
    skipFlashRef.current = true;
  }, [symbol]);


  // Resets all state and refs to clear old symbols data
  useEffect(() => {
    knownBidPricesRef.current = new Set();
    knownAskPricesRef.current = new Set();
    skipFlashRef.current = true;
  }, [priceGrouping]);

  const processOrderBook = useCallback((data: OrderBookData) => {
    if (data.coin !== currentSymbolRef.current) {
      return;
    }

    const [bids, asks] = data.levels;
    setRawBids(bids);
    setRawAsks(asks);
  }, []);

  const { bids, asks, spread, maxBidTotal, maxAskTotal } = useMemo(() => {
    const shouldSkipFlash = skipFlashRef.current;

    const bidsResult = aggregateLevels(
      rawBids,
      priceGrouping,
      true,
      knownBidPricesRef.current,
      shouldSkipFlash
    );

    const asksResult = aggregateLevels(
      rawAsks,
      priceGrouping,
      false,
      knownAskPricesRef.current,
      shouldSkipFlash
    );

    // Update the refs with new known prices
    knownBidPricesRef.current = bidsResult.newKnownPrices;
    knownAskPricesRef.current = asksResult.newKnownPrices;


    // Update refs with newly seen prices for next renders flash detection.
    const aggregatedBids = bidsResult.levels.slice(0, NUM_ROWS);
    const aggregatedAsks = asksResult.levels.slice(0, NUM_ROWS);

    if (rawBids.length > 0 || rawAsks.length > 0) {
      skipFlashRef.current = false;
    }

    const displayAsks = [...aggregatedAsks].reverse();

    let spreadData = null;
    if (aggregatedBids.length > 0 && aggregatedAsks.length > 0) {
      const bestBid = aggregatedBids[0].price;
      const bestAsk = aggregatedAsks[0].price;
      const spreadValue = bestAsk - bestBid;
      const spreadPercentage = (spreadValue / bestAsk) * 100;
      spreadData = { value: spreadValue, percentage: spreadPercentage };
    }

    // Calculate bid/ask spread
    const maxBidTotalAsset = aggregatedBids.length > 0
      ? Math.max(...aggregatedBids.map(b => b.total))
      : 0;
    const maxBidTotalUsdc = aggregatedBids.length > 0
      ? Math.max(...aggregatedBids.map(b => b.totalUsdc))
      : 0;



    // Finding maximum cumulative total on bid side (in both asset units and USDC value) so wecan used for depth visualization bars.
    const maxAskTotalAsset = displayAsks.length > 0
      ? Math.max(...displayAsks.map(a => a.total))
      : 0;
    const maxAskTotalUsdc = displayAsks.length > 0
      ? Math.max(...displayAsks.map(a => a.totalUsdc))
      : 0;

    return {
      bids: aggregatedBids,
      asks: displayAsks,
      spread: spreadData,
      maxBidTotal: { asset: maxBidTotalAsset, usdc: maxBidTotalUsdc },
      maxAskTotal: { asset: maxAskTotalAsset, usdc: maxAskTotalUsdc }
    };
  }, [rawBids, rawAsks, priceGrouping]);

  // Creating the rows for the bid ask so its always the same number as NUM_ROWS if there are less than NUM_ROWs we leave them empty, rows[NUM_ROWS - 1 - i] = ask; is just reversing the order of the asks so the lowest ask price at the bottom near the spread
  const fixedAsks = useMemo(() => {
    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    asks.forEach((ask, i) => {
      rows[NUM_ROWS - 1 - i] = ask;
    });
    return rows;
  }, [asks]);

  const fixedBids = useMemo(() => {
    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    bids.forEach((bid, i) => {
      rows[i] = bid;
    });
    return rows;
  }, [bids]);

  return {
    bids,
    asks,
    fixedBids,
    fixedAsks,
    spread,
    maxBidTotal,
    maxAskTotal,
    processOrderBook
  };
}
```

---

## hooks/useTrades.tsx

**Purpose**: Manages recent trades list with formatting and state management.

**Key Responsibilities**:
- Stores processed trades array
- Formats incoming raw trades (time, price decimals, USDC value)
- Converts side 'B'/'S' to 'buy'/'sell'
- Generates unique IDs for React keys
- Maintains max 50 most recent trades (prepends new, slices)
- Provides reset function for symbol changes

**Architecture Pattern**: Uses `useCallback` for stable function references and `useRef` for mutable counter and symbol tracking that shouldn't trigger re-renders.

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import type { TradeData, ProcessedTrade, Symbol } from '@/lib/types';
import { MAX_TRADES } from '@/lib/constants';

interface UseTradesProps {
  symbol: Symbol;
}

export function useTrades({ symbol }: UseTradesProps) {
  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const tradeIdCounterRef = useRef<number>(0);
  const currentSymbolRef = useRef<string>(symbol);

  const processTrades = useCallback((tradeData: TradeData[]) => {
    if (tradeData.length > 0 && tradeData[0].coin !== currentSymbolRef.current) {
      return;
    }

    const newTrades = tradeData.map(trade => {
      const id = `trade-${tradeIdCounterRef.current++}`;
      const price = parseFloat(trade.px);
      const size = parseFloat(trade.sz);
      const decimals = currentSymbolRef.current === 'BTC' ? 0 : 2;

      return {
        price: price.toFixed(decimals),
        size,
        sizeUsdc: size * price,
        side: trade.side === 'B' ? 'buy' as const : 'sell' as const,
        time: new Date(trade.time).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        id,
      };
    });

    setTrades(prev => [...newTrades, ...prev].slice(0, MAX_TRADES));
  }, []);

  const resetTrades = useCallback(() => {
    setTrades([]);
    tradeIdCounterRef.current = 0;
  }, []);

  // Update current symbol ref
  currentSymbolRef.current = symbol;

  return { trades, processTrades, resetTrades };
}
```

---

# UI Components

## components/ui/Dropdown.tsx

**Purpose**: Generic, reusable dropdown menu component with click-outside detection.

**Features**:
- Typed generic `<T extends string | number>` for flexible value types
- Click-outside detection to close dropdown
- Rotation animation on toggle arrow
- Hover effects with orange-400 highlight
- Dark theme styling

**Architecture Pattern**: Controlled component pattern - parent manages open state via `isOpen` and `onToggle` props, enabling coordination between multiple dropdowns.

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface DropdownOption<T> {
  label: string;
  value: T;
}

interface DropdownProps<T> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  isOpen,
  onToggle
}: DropdownProps<T>) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-1 text-white bg-transparent px-2 py-1 text-sm focus:outline-none hover:text-orange-400 transition-colors cursor-pointer"
      >
        <span>{value}</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-2 w-24 rounded-lg bg-[#131722] shadow-lg border border-gray-800 overflow-hidden z-50"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;

            return (
              <button
                key={String(opt.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                }}
                className={`
                  w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors
                  ${isActive ? 'text-white' : 'text-gray-400'}
                  hover:text-white hover:bg-[#1e222d]
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## components/ui/TabSelector.tsx

**Purpose**: Tab switcher UI component for navigation between views.

**Features**:
- Button array with active underline (orange-500 border)
- Active state scale animation
- Gray hover states for inactive tabs

```typescript
'use client';

interface Tab {
  id: string;
  label: string;
}

interface TabSelectorProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabSelector({ tabs, activeTab, onTabChange }: TabSelectorProps) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer active:scale-[0.97] ${
            activeTab === tab.id
              ? 'text-white border-b-2 border-orange-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

---

## components/OrderBook/OrderBookHeader.tsx

**Purpose**: Top controls header containing all user controls.

**Contains**:
- Symbol icon (BTC/ETH with appropriate symbol)
- Live/Disconnected status indicator
- Price grouping dropdown
- Symbol selector dropdown
- Tab selector (Orders/Trades)
- Denomination toggle (Asset/USDC)

**Architecture Pattern**: Receives all state and setters as props from parent, making it a "dumb" presentational component that delegates state management upward.

```typescript
import type { Symbol, Tab, Denomination } from '@/lib/types';
import { Dropdown } from '@/components/ui/Dropdown';
import { TabSelector } from '@/components/ui/TabSelector';
import { formatGrouping } from '@/lib/utils';
import { BTC_GROUP_OPTIONS, ETH_GROUP_OPTIONS } from '@/lib/constants';

interface OrderBookHeaderProps {
  symbol: Symbol;
  setSymbol: (symbol: Symbol) => void;
  priceGrouping: number;
  setPriceGrouping: (grouping: number) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  denomination: Denomination;
  setDenomination: (denom: Denomination) => void;
  isConnected: boolean;
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
}

export function OrderBookHeader({
  symbol,
  setSymbol,
  priceGrouping,
  setPriceGrouping,
  activeTab,
  setActiveTab,
  denomination,
  setDenomination,
  isConnected,
  openMenu,
  setOpenMenu
}: OrderBookHeaderProps) {
  const groupOptions = symbol === 'BTC' ? BTC_GROUP_OPTIONS : ETH_GROUP_OPTIONS;

  return (
    <div className="bg-[#131722] rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold">
            {symbol === 'BTC' ? '₿' : 'Ξ'}
          </div>

          <div>
            <div className="font-semibold">{symbol}-USD</div>
            <div className="text-xs text-gray-500">Perpetuals</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Price Grouping Dropdown */}
          <Dropdown
            value={priceGrouping}
            onChange={(val) => {
              setPriceGrouping(val);
              setOpenMenu(null);
            }}
            options={groupOptions.map(opt => ({
              label: formatGrouping(opt),
              value: opt,
            }))}
            isOpen={openMenu === 'priceGrouping'}
            onToggle={() =>
              setOpenMenu(openMenu === 'priceGrouping' ? null : 'priceGrouping')
            }
          />

          {/* Symbol Selector */}
          <Dropdown
            value={symbol}
            onChange={(val) => {
              setSymbol(val as Symbol);
              setOpenMenu(null);
            }}
            options={[
              { label: 'BTC', value: 'BTC' },
              { label: 'ETH', value: 'ETH' },
            ]}
            isOpen={openMenu === 'symbol'}
            onToggle={() =>
              setOpenMenu(openMenu === 'symbol' ? null : 'symbol')
            }
          />
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center justify-between border-b border-gray-800">
        <TabSelector
          tabs={[
            { id: 'orderbook', label: 'Orders' },
            { id: 'trades', label: 'Trades' }
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as Tab)}
        />

        {/* Denomination Toggle */}
        <div className="flex items-center gap-1 pb-2">
          <button
            onClick={() => setDenomination('asset')}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer active:scale-[0.97] ${
              denomination === 'asset'
                ? 'bg-orange-500 text-white'
                : 'bg-[#1e222d] text-gray-400 hover:text-white'
            }`}
          >
            {symbol}
          </button>
          <button
            onClick={() => setDenomination('usdc')}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer active:scale-[0.97] ${
              denomination === 'usdc'
                ? 'bg-orange-500 text-white'
                : 'bg-[#1e222d] text-gray-400 hover:text-white'
            }`}
          >
            USDC
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## components/OrderBook/OrderBookTable.tsx

**Purpose**: Main orderbook display with 2-column layout (asks left, bids right).

**Layout**:
- Header row with column labels (Price, Size, Total x2)
- 2-column grid layout with asks on left, bids on right
- Asks sorted descending (highest ask at top)
- Bids sorted ascending (highest bid at top)

**Key Logic**: Calculates depth percentage for each row based on cumulative total relative to max total.

```typescript
import type { ProcessedLevel, Denomination, Symbol } from '@/lib/types';
import { OrderBookRow } from './OrderBookRow';
import { SpreadIndicator } from './SpreadIndicator';
import { getDenomLabel } from '@/lib/utils';

interface OrderBookTableProps {
  fixedAsks: (ProcessedLevel | null)[];
  fixedBids: (ProcessedLevel | null)[];
  spread: { value: number; percentage: number } | null;
  maxAskTotal: number;
  maxBidTotal: number;
  denomination: Denomination;
  symbol: Symbol;
}

export function OrderBookTable({
  fixedAsks,
  fixedBids,
  spread,
  maxAskTotal,
  maxBidTotal,
  denomination,
  symbol
}: OrderBookTableProps) {
  const denomLabel = getDenomLabel(denomination, symbol);

  return (
    <div className="bg-[#131722] rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
        <div className="text-left">Price</div>
        <div className="text-center">Size ({denomLabel})</div>
        <div className="text-right">Total ({denomLabel})</div>

        <div className="text-left">Price</div>
        <div className="text-center">Size ({denomLabel})</div>
        <div className="text-right">Total ({denomLabel})</div>
      </div>

      {/* Asks */}
      <div className="grid grid-cols-2 gap-4">


      <div className="relative">
        {fixedAsks.map((ask, index) => {
          const depthValue = ask
            ? (denomination === 'asset' ? ask.total : ask.totalUsdc)
            : 0;
          const depthPercentage = maxAskTotal > 0 ? (depthValue / maxAskTotal) * 100 : 0;

          return (
            <OrderBookRow
              key={`ask-row-${index}`}
              level={ask}
              side="ask"
              depthPercentage={depthPercentage}
              denomination={denomination}
              displaySide="left-0"
            />
          );
        })}
      </div>


      {/* Bids */}
      <div className="relative">
        {fixedBids.map((bid, index) => {
          const depthValue = bid
            ? (denomination === 'asset' ? bid.total : bid.totalUsdc)
            : 0;
          const depthPercentage = maxBidTotal > 0 ? (depthValue / maxBidTotal) * 100 : 0;

          return (
            <OrderBookRow
              key={`bid-row-${index}`}
              level={bid}
              side="bid"
              depthPercentage={depthPercentage}
              denomination={denomination}
              displaySide='right-0'
            />
          );
        })}
      </div>

      </div>

      {/* Spread */}
      <SpreadIndicator spread={spread} />
    </div>
  );
}
```

---

## components/OrderBook/OrderBookRow.tsx

**Purpose**: Single orderbook row renderer with depth visualization.

**Features**:
- Conditional rendering (null rows are empty placeholders)
- Colored depth bars (green for bids, red for asks)
- Flash animation on new prices (`animate-flash-row-green` or `animate-flash-row-red`)
- Price in bold, size centered, total right-aligned
- Smooth transition on bar width changes (300ms ease-out)
- Monospace fonts for alignment

**Visual Design**: Depth bar is absolutely positioned behind the content, with width based on percentage of max cumulative total.

```typescript
import type { ProcessedLevel, Denomination } from '@/lib/types';
import { formatSize, formatTotal } from '@/lib/utils';

interface OrderBookRowProps {
  level: ProcessedLevel | null;
  side: 'bid' | 'ask';
  depthPercentage: number;
  denomination: Denomination;
  displaySide: string;
}

export function OrderBookRow({
  level,
  side,
  depthPercentage,
  denomination,
  displaySide
}: OrderBookRowProps) {
  const isBid = side === 'bid';
  const colorClass = isBid ? 'text-green-500' : 'text-red-500';
  const bgColorClass = isBid ? 'bg-green-500/10' : 'bg-red-500/10';
  const flashClass = level?.isNew
    ? (isBid ? 'animate-flash-row-green' : 'animate-flash-row-red')
    : '';



  return (
    <div
      className={`relative grid grid-cols-3 gap-2 px-4 py-1.5 text-sm h-8 ${flashClass}`}
    >
      {level ? (
        <>
          <div
            className={`absolute top-[1px] bottom-[1px]
                ${displaySide}
                ${bgColorClass} transition-[width] duration-300 ease-out`}
            style={{ width: `${depthPercentage}%` }}
          />

          <div className={`${colorClass} font-mono relative z-10 text-left`}>
            {level.priceStr}
          </div>

          <div className="text-gray-300 font-mono relative z-10 text-center">
            {formatSize(level.size, level.sizeUsdc, denomination)}
          </div>

          <div className="text-gray-500 font-mono text-xs relative z-10 text-right">
            {formatTotal(level.total, level.totalUsdc, denomination)}
          </div>
        </>
      ) : (
        <>
          <div
            className={`absolute top-[1px] bottom-[1px]
                ${displaySide}
                ${bgColorClass}
                transition-[width] duration-300 ease-out`}
            style={{ width: '0%' }}
          />
          <div className={`${colorClass} font-mono relative z-10`}>&nbsp;</div>
          <div className="text-gray-300 font-mono relative z-10">&nbsp;</div>
          <div className="text-gray-500 font-mono text-xs relative z-10">&nbsp;</div>
        </>
      )}
    </div>
  );
}
```

---

## components/OrderBook/TradesTable.tsx

**Purpose**: Recent trades display with dynamic row heights.

**Features**:
- Scrollable container (1000px height max)
- Dynamic row height based on trade size (h-8 to h-50)
- Color-coded rows (green for buys, rose/pink for sells)
- Black text on colored background
- 3-column layout: Price, Size, Time
- Max 50 trades with auto-scroll updates

**Size Tiers**: 10000+ (h-50), 5000+ (h-20), 3000+ (h-16), 1000+ (h-12), 50+ (h-10), default (h-8)

```typescript
import type { ProcessedTrade, Denomination, Symbol } from '@/lib/types';
import { formatSize, getDenomLabel } from '@/lib/utils';

interface TradesTableProps {
  trades: ProcessedTrade[];
  denomination: Denomination;
  symbol: Symbol;
}

export function TradesTable({ trades, denomination, symbol }: TradesTableProps) {
  const denomLabel = getDenomLabel(denomination, symbol);

  const getTradeHeight = (trade: ProcessedTrade): string => {
    const size = denomination === 'asset' ? trade.size : trade.sizeUsdc;

    if (size >= 10000) return 'h-50';
    if (size >= 5000) return 'h-20';
    if (size >= 3000) return 'h-16';
    if (size >= 1000) return 'h-12';
    if (size >= 50) return 'h-10';
    return 'h-8';
  }


  return (
    <div className="bg-[#131722] rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
        <div className="text-left">Price</div>
        <div className="text-center">Size ({denomLabel})</div>
        <div className="text-right">Time</div>
      </div>

      {/* Trades List */}
      <div className={`
      min-h-[1000px]
      max-h-[1000px]
      overflow-y-auto
      `}>
        {trades.map((trade) => (

            <div className={`${trade.side === 'buy' ? 'bg-green-400' : 'bg-rose-400' } text-black`}>
          <div
            key={trade.id}
            className={`grid grid-cols-3 gap-2 px-4 py-1.5 text-sm hover:bg-[#1e222d] transition-colors
            border
            ${getTradeHeight(trade)}
            `}
          >
            <div
              className={`font-mono text-left
                text-black
              `}
            >
              {trade.price}
            </div>

            <div className="text-center text-black-300 font-mono">
              {formatSize(trade.size, trade.sizeUsdc, denomination)}
            </div>

            <div className="text-right text-black-500 text-md">
              {trade.time}
            </div>
          </div>


        </div>

        ))}
      </div>
    </div>
  );
}
```

---

## components/OrderBook/SpreadIndicator.tsx

**Purpose**: Displays bid-ask spread information.

**Display**:
- Left: "Spread" label
- Center: Absolute spread value (2 decimals)
- Right: Percentage (3 decimals)

**Behavior**: Returns null if no spread data available.

```typescript
interface SpreadIndicatorProps {
    spread: {
      value: number;
      percentage: number;
    } | null;
  }

  export function SpreadIndicator({ spread }: SpreadIndicatorProps) {
    if (!spread) return null;

    return (
      <div className="px-4 py-3 bg-[#1e222d] border-y border-gray-800">
        <div className="grid grid-cols-3 items-center text-sm">
          {/* Left: Label  */}
          <div className="text-gray-500 text-left">
            Spread
          </div>

          {/* Center: Absolute spread */}
          <div className="text-center text-gray-300 font-mono">
            {spread.value.toFixed(2)}
          </div>

          {/* Right: Percentage */}
          <div className="text-right text-xs text-gray-500 font-mono">
            {spread.percentage.toFixed(3)}%
          </div>
        </div>
      </div>
    );
  }
```

---

# Main Page

## app/page.tsx

**Purpose**: Main OrderBook page - orchestrates all state and data flow.

**State Management**:
- `symbol`: 'BTC' | 'ETH' (default BTC)
- `priceGrouping`: number (default 1 for BTC, 0.1 for ETH)
- `activeTab`: 'orderbook' | 'trades' (default orderbook)
- `denomination`: 'asset' | 'usdc' (default asset)
- `openMenu`: string | null (tracks which dropdown is open)

**Data Flow**:
1. `useWebSocket` connects to API -> triggers `processOrderBook` and `processTrades` callbacks
2. `useOrderBookState` aggregates raw levels -> computes spread and depth
3. `useTrades` formats incoming trades
4. Conditional render: OrderBookTable XOR TradesTable based on activeTab
5. Resets trades and grouping when symbol changes

**UI Structure**:
- Dark theme (#0a0e13 background)
- Max-width 512px centered
- Header -> Conditional table -> Footer (Live indicator)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { OrderBookHeader } from '@/components/OrderBook/OrderBookHeader';
import { OrderBookTable } from '@/components/OrderBook/OrderBookTable';
import { TradesTable } from '@/components/OrderBook/TradesTable';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOrderBookState } from '@/hooks/useOrderBookState';
import { useTrades } from '@/hooks/useTrades';
import type { Symbol, Tab, Denomination } from '@/lib/types';

export default function OrderBook() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [priceGrouping, setPriceGrouping] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<Tab>('orderbook');
  const [denomination, setDenomination] = useState<Denomination>('asset');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Custom hooks
  const {
    fixedBids,
    fixedAsks,
    spread,
    maxBidTotal,
    maxAskTotal,
    processOrderBook
  } = useOrderBookState({ symbol, priceGrouping });

  const { trades, processTrades, resetTrades } = useTrades({ symbol });

  const { isConnected } = useWebSocket({
    symbol,
    onOrderBookUpdate: processOrderBook,
    onTradesUpdate: processTrades
  });

  // Reset trades when symbol changes
  useEffect(() => {
    resetTrades();
    setPriceGrouping(symbol === 'BTC' ? 1 : 0.1);
  }, [symbol, resetTrades]);

  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-4">
      <div className="max-w-lg mx-auto">
        <OrderBookHeader
          symbol={symbol}
          setSymbol={setSymbol}
          priceGrouping={priceGrouping}
          setPriceGrouping={setPriceGrouping}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          denomination={denomination}
          setDenomination={setDenomination}
          isConnected={isConnected}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />

        {activeTab === 'orderbook' ? (
          <OrderBookTable
            fixedAsks={fixedAsks}
            fixedBids={fixedBids}
            spread={spread}
            maxAskTotal={denomination === 'asset' ? maxAskTotal.asset : maxAskTotal.usdc}
            maxBidTotal={denomination === 'asset' ? maxBidTotal.asset : maxBidTotal.usdc}
            denomination={denomination}
            symbol={symbol}
          />
        ) : (
          <TradesTable
            trades={trades}
            denomination={denomination}
            symbol={symbol}
          />
        )}

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-gray-600">
          {isConnected ? (
            <span className="text-green-500">● Live</span>
          ) : (
            <span className="text-red-500">● Disconnected</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

# Key Architecture Decisions

## 1. Client-Side Price Grouping
Instead of requesting different precision levels from the API (which would require reconnecting), the app subscribes once with full precision (`nSigFigs: null`) and performs grouping client-side. This allows instant grouping changes without network latency.

## 2. Separation of Concerns
- **Hooks**: Handle data fetching, state management, and business logic
- **Components**: Pure presentation, receive data via props
- **Lib**: Utility functions and type definitions

## 3. Flash Animation Detection
Uses `Set<number>` refs to track known prices. New prices that weren't in the previous set trigger flash animations. The first render skips flashing to avoid initial load flash.

## 4. Fixed Row Count
Always renders exactly 15 rows per side using `fixedAsks`/`fixedBids` arrays. Empty slots render as null, maintaining consistent layout.

## 5. Dual Denomination Support
All values are calculated in both asset and USDC. The `denomination` toggle switches display without recalculation.

## 6. Controlled Dropdowns
Parent manages which dropdown is open via `openMenu` state, ensuring only one dropdown is open at a time.

---

# Feature Summary Table

| Feature | Implementation |
|---------|----------------|
| **Live Data** | WebSocket to Hyperliquid with auto-reconnect |
| **Price Grouping** | Client-side aggregation (quantizePrice + aggregateLevels) |
| **Depth Visualization** | Percentage-based background bars + cumulative totals |
| **Flash Animation** | Tracks known prices, highlights new entries |
| **Spread Calculation** | bestAsk - bestBid (value & percentage) |
| **Multi-Symbol** | BTC & ETH with different grouping options |
| **Denomination Toggle** | Display sizes in asset or USDC value |
| **Tab Navigation** | Switch between orderbook and recent trades |
| **Responsive Heights** | Trade rows scale by size |
| **Color Coding** | Green (bids/buys) vs Red (asks/sells) |
