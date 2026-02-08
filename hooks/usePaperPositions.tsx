'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaperPosition } from '@/lib/types';
import { apiFetch } from '@/lib/apiFetch';

type OpenRequest = {
  symbol: string;
  side: 'long' | 'short';
  positionSize: number;
  leverage: number;
};

export function usePaperPositions() {
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/positions');
      if (!res.ok) return;
      const data = await res.json();
      setPositions(data.positions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openPosition = useCallback(async (payload: OpenRequest) => {
    const res = await apiFetch('/api/positions/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to open position');
    setPositions((prev) => {
      const exists = prev.some((p) => p.symbol === data.position.symbol && p.side === data.position.side);
      if (exists) return prev;
      return [...prev, data.position];
    });
    return data;
  }, []);

  const closePosition = useCallback(async (positionId: number) => {
    const res = await apiFetch('/api/positions/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to close position');
    setPositions((prev) => prev.filter((p) => p.id !== positionId));
    return data;
  }, []);

  return { positions, loading, refresh, openPosition, closePosition };
}
