'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaperTrade } from '@/lib/types';
import { apiFetch } from '@/lib/apiFetch';

export function usePaperTrades() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/positions/trades');
      if (!res.ok) return;
      const data = await res.json();
      setTrades(data.trades ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trades, loading, refresh };
}
