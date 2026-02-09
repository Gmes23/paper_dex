'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { TradeData } from '@/lib/types';
import { apiFetch } from '@/lib/apiFetch';

interface UsePersistedTradesProps {
  enabled?: boolean;
  source: 'mock' | 'live';
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export function usePersistedTrades({
  enabled = true,
  source,
  flushIntervalMs = 20000,
  maxBatchSize = 500,
}: UsePersistedTradesProps) {
  const bufferRef = useRef<TradeData[]>([]);
  const inflightRef = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled || inflightRef.current) return;

    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    if (batch.length === 0) return;

    inflightRef.current = true;
    try {
      await apiFetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: batch, source }),
      });
    } catch (err) {
      bufferRef.current.unshift(...batch);
      console.warn('Failed to persist trades, will retry.', err);
    } finally {
      inflightRef.current = false;
    }
  }, [enabled, source]);

  const enqueue = useCallback(
    (trades: TradeData[]) => {
      if (!enabled || trades.length === 0) return;
      bufferRef.current.push(...trades);

      if (bufferRef.current.length >= maxBatchSize) {
        void flush();
      }
    },
    [enabled, flush, maxBatchSize]
  );

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      void flush();
    }, flushIntervalMs);

    return () => clearInterval(timer);
  }, [enabled, flush, flushIntervalMs]);

  return { enqueue, flush };
}
