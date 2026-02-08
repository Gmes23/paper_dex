// hooks/useChartData.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getIntervalMs, TimeInterval, CandleData } from '@/lib/chartUtils';
import { apiFetch } from '@/lib/apiFetch';
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

  // Track the last trade time (ms) we've already processed
  const lastProcessedTradeTimeMsRef = useRef<number>(0);

  // Reset when symbol/interval changes
  useEffect(() => {
    lastProcessedTradeTimeMsRef.current = 0;
    setCandles([]);
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
        const res = await apiFetch(
          `/api/candles?symbol=${symbol}&interval=${interval}&limit=500`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`Failed to fetch DB candles (${res.status})`);

        const payload = await res.json();
        const raw: CandleData[] = Array.isArray(payload?.candles) ? payload.candles : [];
        if (cancelled) return;

        const data = [...raw].sort((a, b) => a.time - b.time);
        setCandles(data);

        const last = data.length > 0 ? data[data.length - 1].time : null;
        lastCandleTimeRef.current = last;

        console.info('📦 Loaded DB candles', {
          count: data.length,
          lastCandleTime: last,
        });
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
    if (trades.length === 0) {
      lastProcessedTradeTimeMsRef.current = 0;
      return;
    }

    const lastCandleTimeMs = lastCandleTimeRef.current
      ? lastCandleTimeRef.current * 1000
      : null;

    const newTrades = trades.filter(
      (trade) =>
        Number.isFinite(trade.timeMs) &&
        trade.timeMs > lastProcessedTradeTimeMsRef.current
    );

    if (newTrades.length === 0) return;

    const maxTradeTimeMs = Math.max(...newTrades.map((t) => t.timeMs));
    lastProcessedTradeTimeMsRef.current = maxTradeTimeMs;

    const filteredTrades = lastCandleTimeMs
      ? newTrades.filter((trade) => trade.timeMs >= lastCandleTimeMs)
      : newTrades;

    if (lastCandleTimeMs && maxTradeTimeMs < lastCandleTimeMs) {
      console.warn('⚠️ Trades are behind last candle time', {
        lastCandleTimeMs,
        maxTradeTimeMs,
        lagSeconds: Math.round((lastCandleTimeMs - maxTradeTimeMs) / 1000),
      });
    }

    if (filteredTrades.length === 0) return;

    console.info('🔄 Processing realtime trades', {
      newTrades: newTrades.length,
      totalTrades: trades.length,
      lastCandleTimeMs,
      maxTradeTimeMs,
    });

    const intervalMs = getIntervalMs(interval);
    const sortedTrades = [...filteredTrades].sort((a, b) => a.timeMs - b.timeMs);

    setCandles((prev) => {
      const next = [...prev];
      let lastTime = next.length > 0 ? next[next.length - 1].time : null;

      for (const trade of sortedTrades) {
        if (!Number.isFinite(trade.timeMs)) continue;

        const price = parseFloat(trade.price);
        if (!Number.isFinite(price)) continue;

        const bucketMs = Math.floor(trade.timeMs / intervalMs) * intervalMs;
        const bucketSec = Math.floor(bucketMs / 1000);

        if (lastTime === null) {
          next.push({
            time: bucketSec,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: trade.size,
          });
          lastTime = bucketSec;
          continue;
        }

        if (bucketSec > lastTime) {
          next.push({
            time: bucketSec,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: trade.size,
          });
          lastTime = bucketSec;
          continue;
        }

        if (bucketSec === lastTime) {
          const last = next[next.length - 1];
          if (!last) {
            next.push({
              time: bucketSec,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: trade.size,
            });
            lastTime = bucketSec;
            continue;
          }
          next[next.length - 1] = {
            ...last,
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
            close: price,
            volume: last.volume + trade.size,
          };
        }
      }

      if (lastTime !== null) {
        lastCandleTimeRef.current = lastTime;
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
      const res = await apiFetch(
        `/api/candles?symbol=${symbol}&interval=${interval}&limit=500`,
        { signal: controller.signal }
      );

      if (!res.ok) throw new Error(`Failed to refresh candles (${res.status})`);

      const payload = await res.json();
      const raw: CandleData[] = Array.isArray(payload?.candles) ? payload.candles : [];
      const data = [...raw].sort((a, b) => a.time - b.time);
      setCandles(data);

      const last = data.length > 0 ? data[data.length - 1].time : null;
      lastCandleTimeRef.current = last;
      lastProcessedTradeTimeMsRef.current = 0; // Reset trade counter on refresh

      console.info('🔄 Refreshed DB candles', { count: data.length });
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
    lastCandleTime: lastCandleTimeRef.current,
    lastProcessedTradeTimeMs: lastProcessedTradeTimeMsRef.current,
  };
}
