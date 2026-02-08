'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { OrderBookData } from '@/lib/types';
import { apiFetch } from '@/lib/apiFetch';

interface UsePersistedOrderBookProps {
  enabled?: boolean;
  source: 'mock' | 'live';
  flushIntervalMs?: number;
}

export function usePersistedOrderBook({
  enabled = true,
  source,
  flushIntervalMs = 1500,
}: UsePersistedOrderBookProps) {
  const latestRef = useRef<OrderBookData | null>(null);
  const inflightRef = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled || inflightRef.current || !latestRef.current) return;

    const snapshot = latestRef.current;
    latestRef.current = null;

    inflightRef.current = true;
    try {
      await apiFetch('/api/orderbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, source }),
      });
    } catch (err) {
      latestRef.current = snapshot;
      console.warn('Failed to persist orderbook, will retry.', err);
    } finally {
      inflightRef.current = false;
    }
  }, [enabled, source]);

  const enqueue = useCallback(
    (snapshot: OrderBookData) => {
      if (!enabled) return;
      latestRef.current = snapshot;
    },
    [enabled]
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
