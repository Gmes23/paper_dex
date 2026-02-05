// hooks/useChartData.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { aggregateTradesToCandles, TimeInterval, CandleData } from '@/lib/chartUtils';
import type { ProcessedTrade } from '@/lib/types';

interface UseChartDataProps {
  symbol: string;
  interval: TimeInterval;
  trades: ProcessedTrade[];
}

export function useChartData({ symbol, interval, trades }: UseChartDataProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track last candle time we trust (seconds)
  const lastCandleTimeRef = useRef<number | null>(null);

  // Track how many trades we've already processed
  const processedTradeCountRef = useRef<number>(0);

  // Reset when symbol/interval changes
  useEffect(() => {
    processedTradeCountRef.current = 0;
    // setCandles([]); 
    lastCandleTimeRef.current = null;
  }, [symbol, interval]);

  // 1️⃣ Load historical candles from DB
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadFromDB() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/candles?symbol=${symbol}&interval=${interval}&limit=500`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`Failed to fetch DB candles (${res.status})`);

        const data: CandleData[] = await res.json();
        if (cancelled) return;

        setCandles(data);

        const last = data[data.length - 1]?.time ?? null;
        lastCandleTimeRef.current = last;

        console.log(`📦 Loaded ${data.length} DB candles. Last candle time:`, last);
      } catch (err) {
        if (cancelled) return;
        if ((err as any)?.name === 'AbortError') return;

        setError(err instanceof Error ? err.message : 'Failed to load candles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFromDB();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, interval]);

  // 2️⃣ Merge realtime trades into candles (incremental)
  useEffect(() => {
    if (loading) return;
    if (trades.length === 0) return;

    // Only process NEW trades (ones we haven't seen before)
    const newTrades = trades.slice(processedTradeCountRef.current);
    
    if (newTrades.length === 0) return;

    console.log(`🔄 Processing ${newTrades.length} new trades (total: ${trades.length})`);

    // Update our counter
    processedTradeCountRef.current = trades.length;

    // Aggregate only the new trades
    const realtimeCandles = aggregateTradesToCandles(newTrades, interval);
    
    if (realtimeCandles.length === 0) return;

    console.log(`🕯️ Generated ${realtimeCandles.length} candles from new trades`);

    setCandles((prev) => {
      const next = [...prev];
      let lastTime = lastCandleTimeRef.current;

      for (const newCandle of realtimeCandles) {
        // If we have no baseline, accept it
        if (lastTime === null) {
          next.push(newCandle);
          lastTime = newCandle.time;
          lastCandleTimeRef.current = newCandle.time;
          console.log('📊 First candle added:', newCandle.time);
          continue;
        }

        // New candle (different time bucket)
        if (newCandle.time > lastTime) {
          next.push(newCandle);
          lastTime = newCandle.time;
          lastCandleTimeRef.current = newCandle.time;
          console.log('📊 New candle bar:', new Date(newCandle.time * 1000).toLocaleTimeString());
          continue;
        }

        // Update current candle (same time bucket)
        if (newCandle.time === lastTime) {
          const oldCandle = next[next.length - 1];
          next[next.length - 1] = newCandle;
          console.log('🔄 Updated current candle:', {
            time: new Date(newCandle.time * 1000).toLocaleTimeString(),
            old: `O:${oldCandle.open} H:${oldCandle.high} L:${oldCandle.low} C:${oldCandle.close}`,
            new: `O:${newCandle.open} H:${newCandle.high} L:${newCandle.low} C:${newCandle.close}`
          });
        }
      }

      return next;
    });
  }, [trades, interval, loading]);

  // 3️⃣ Manual refresh (DB only)
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    try {
      const res = await fetch(
        `/api/candles?symbol=${symbol}&interval=${interval}&limit=500`,
        { signal: controller.signal }
      );

      if (!res.ok) throw new Error(`Failed to refresh candles (${res.status})`);

      const data: CandleData[] = await res.json();

      setCandles(data);

      const last = data[data.length - 1]?.time ?? null;
      lastCandleTimeRef.current = last;
      processedTradeCountRef.current = 0; // Reset trade counter on refresh
      
      console.log(`🔄 Refreshed ${data.length} candles from DB`);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  return {
    candles,
    candlesCount: candles.length,
    loading,
    error,
    refresh,
    firstCandle: candles[0] || null,
    lastCandle: candles[candles.length - 1] || null,
  };
}