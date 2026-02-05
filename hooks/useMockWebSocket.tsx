// hooks/useMockWebSocket.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { MockTradeGenerator, generateMockOrderBook, MockTrade } from '@/lib/mockData';

interface UseMockWebSocketProps {
  symbol: string;
  onTradesUpdate: (trade: MockTrade) => void;
  onOrderBookUpdate?: (orderBook: any) => void;

  enabled?: boolean;
  tradeIntervalMs?: number;   // how often to emit a trade (REAL time)
  speedMultiplier?: number;   // how fast SIMULATED time moves
  historicalCount?: number;
}

export function useMockWebSocket({
  symbol,
  onTradesUpdate,
  onOrderBookUpdate,
  enabled = true,
  tradeIntervalMs = 2000,
  speedMultiplier = 1,
  historicalCount = 100,
}: UseMockWebSocketProps) {
  const generatorRef = useRef<MockTradeGenerator | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ Track historical load state + timeouts to avoid leaks
  const hasLoadedHistoricalRef = useRef(false);
  const historicalTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ✅ Avoid stale closures without restarting the interval every render
  const onTradesUpdateRef = useRef(onTradesUpdate);
  const onOrderBookUpdateRef = useRef(onOrderBookUpdate);

  useEffect(() => {
    onTradesUpdateRef.current = onTradesUpdate;
  }, [onTradesUpdate]);

  useEffect(() => {
    onOrderBookUpdateRef.current = onOrderBookUpdate;
  }, [onOrderBookUpdate]);

  // ✅ Initialize generator (or re-init if symbol changes and you want different base behavior)
  useEffect(() => {
    if (!generatorRef.current) {
      // basePrice here is your starting price for mock world
      generatorRef.current = new MockTradeGenerator(43000, 0.001);
    }
  }, []);

  // ✅ Helper: clear historical timeouts safely
  const clearHistoricalTimeouts = useCallback(() => {
    historicalTimeoutsRef.current.forEach((t) => clearTimeout(t));
    historicalTimeoutsRef.current = [];
  }, []);

  // ✅ Reset historical “loaded” when symbol changes OR when you disable/enable again
  useEffect(() => {
    hasLoadedHistoricalRef.current = false;
    clearHistoricalTimeouts();
  }, [symbol, clearHistoricalTimeouts]);

  useEffect(() => {
    if (!enabled) {
      hasLoadedHistoricalRef.current = false;
      clearHistoricalTimeouts();
    }
  }, [enabled, clearHistoricalTimeouts]);

  // ------------------------------------------------------------
  // 1) Load historical mock trades once (optional)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    if (!generatorRef.current) return;
    if (hasLoadedHistoricalRef.current) return;
    if (historicalCount <= 0) return;

    console.log(`📚 Loading ${historicalCount} historical trades...`);

    // 🔥 Key idea:
    // make history cover a realistic span of simulated time.
    // Here we treat speedMultiplier as “simulated time multiplier”, so historical spacing grows too.
    const simulatedIntervalMs = Math.max(1, tradeIntervalMs * speedMultiplier);

    const historicalTrades = generatorRef.current.generateHistoricalTrades(
      historicalCount,
      simulatedIntervalMs
    );

    // Feed historical trades quickly (but store timeouts so we can cancel)
    historicalTrades.forEach((trade, index) => {
      const t = setTimeout(() => {
        onTradesUpdateRef.current(trade);
      }, index * 5); // fast feed; adjust if you want slower backfill

      historicalTimeoutsRef.current.push(t);
    });

    hasLoadedHistoricalRef.current = true;
    console.log(`✅ Loaded ${historicalCount} historical trades`);

    // cleanup if effect re-runs / unmount
    return () => {
      clearHistoricalTimeouts();
    };
  }, [enabled, historicalCount, tradeIntervalMs, speedMultiplier, clearHistoricalTimeouts]);

  // ------------------------------------------------------------
  // 2) Generate real-time trades (mock websocket)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    if (!generatorRef.current) return;

    // ✅ This is the critical fix for “never moves to next candle”:
    // We advance SIMULATED time by tradeIntervalMs * speedMultiplier every tick.
    // That means on 5m candles you can reach the next bucket quickly.
    const simulatedAdvanceMs = Math.max(1, tradeIntervalMs * speedMultiplier);

    console.log(
      `🔴 Mock WS START | emit every ${tradeIntervalMs}ms real-time | simulate +${simulatedAdvanceMs}ms per tick (x${speedMultiplier})`
    );

    intervalRef.current = setInterval(() => {
      const gen = generatorRef.current;
      if (!gen) return;

      // ✅ Force time forward (convert ms -> minutes for your generator)
      gen.fastForward(simulatedAdvanceMs / 60000);

      // Generate one trade and publish it
      const trade = gen.generateTrade();
      onTradesUpdateRef.current(trade);

      // Optional orderbook update
      const obCb = onOrderBookUpdateRef.current;
      if (obCb) {
        const orderBook = generateMockOrderBook(parseFloat(trade.price), symbol);
        obCb(orderBook);
      }
    }, tradeIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('🔵 Mock WS STOP');
      }
    };
  }, [enabled, tradeIntervalMs, speedMultiplier, symbol]);

  // ------------------------------------------------------------
  // Manual controls
  // ------------------------------------------------------------
  const fastForward = useCallback((minutes: number) => {
    const gen = generatorRef.current;
    if (!gen) return;
    gen.fastForward(minutes);
    console.log(`⏩ Fast forwarded ${minutes} minutes`);
  }, []);

  const generateBatch = useCallback(
    (count: number) => {
      const gen = generatorRef.current;
      if (!gen) return;

      console.log(`📦 Generating ${count} trades...`);

      // Make batch generation also move simulated time so candles can form
      const simulatedAdvanceMs = Math.max(1, tradeIntervalMs * speedMultiplier);

      for (let i = 0; i < count; i++) {
        gen.fastForward(simulatedAdvanceMs / 60000);
        const trade = gen.generateTrade();
        onTradesUpdateRef.current(trade);

        const obCb = onOrderBookUpdateRef.current;
        if (obCb) {
          const orderBook = generateMockOrderBook(parseFloat(trade.price), symbol);
          obCb(orderBook);
        }
      }
    },
    [tradeIntervalMs, speedMultiplier, symbol]
  );

  return {
    fastForward,
    generateBatch,
    isConnected: enabled,
  };
}
