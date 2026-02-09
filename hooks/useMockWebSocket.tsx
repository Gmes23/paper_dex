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
  startTimeMs?: number;
  //Simulate volatility
  volatility?: number;
}

export function useMockWebSocket({
  symbol,
  onTradesUpdate,
  onOrderBookUpdate,
  enabled = true,
  tradeIntervalMs = 300,
  speedMultiplier = 1,
  historicalCount = 100,
  startTimeMs,
  volatility = 0.100,
}: UseMockWebSocketProps) {
  const generatorRef = useRef<MockTradeGenerator | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasLoadedHistoricalRef = useRef(false);
  const historicalTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);


  const onTradesUpdateRef = useRef(onTradesUpdate);
  const onOrderBookUpdateRef = useRef(onOrderBookUpdate);

  useEffect(() => {
    onTradesUpdateRef.current = onTradesUpdate;
  }, [onTradesUpdate]);

  useEffect(() => {
    onOrderBookUpdateRef.current = onOrderBookUpdate;
  }, [onOrderBookUpdate]);

  useEffect(() => {
    if (!generatorRef.current) {
      // basePrice here is your starting price for mock world
      generatorRef.current = new MockTradeGenerator(43000, volatility);
      if (Number.isFinite(startTimeMs)) {
        generatorRef.current.setCurrentTimeMs(startTimeMs as number);
      }
    }
  }, []);

  useEffect(() => {
    if (!generatorRef.current) return;
    if (!Number.isFinite(startTimeMs)) return;
    generatorRef.current.setCurrentTimeMs(startTimeMs as number);
  }, [startTimeMs]);

  const clearHistoricalTimeouts = useCallback(() => {
    historicalTimeoutsRef.current.forEach((t) => clearTimeout(t));
    historicalTimeoutsRef.current = [];
  }, []);

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

    // console.log(`📚 Loading ${historicalCount} historical trades...`);

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


    const simulatedAdvanceMs = Math.max(1, tradeIntervalMs * speedMultiplier);

    intervalRef.current = setInterval(() => {
      const gen = generatorRef.current;
      if (!gen) return;

      
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

  const syncToTimeMs = useCallback((timeMs: number) => {
    const gen = generatorRef.current;
    if (!gen) return;
    if (!Number.isFinite(timeMs)) return;
    gen.setCurrentTimeMs(timeMs);
    console.log('🧭 Synced mock time', { timeMs, time: new Date(timeMs).toISOString() });
  }, []);

  const generateBatch = useCallback(
    (count: number) => {
      const gen = generatorRef.current;
      if (!gen) return;

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
    syncToTimeMs,
    isConnected: enabled,
  };
}
