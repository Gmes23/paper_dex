'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaperOrder } from '@/lib/types';
import { apiFetch } from '@/lib/apiFetch';

type PlaceOrderPayload = {
  symbol: string;
  side: 'long' | 'short';
  orderType: 'market' | 'limit';
  positionSize: number;
  leverage: number;
  limitPrice?: number;
  stopLossPrice?: number | null;
};

export function usePaperOrders() {
  const [openOrders, setOpenOrders] = useState<PaperOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOpenOrders = useCallback(async (nextSymbol?: string) => {
    const symbolQuery = nextSymbol ? `&symbol=${encodeURIComponent(nextSymbol)}` : '';
    setLoading(true);
    try {
      const res = await apiFetch(`/api/orders?status=open${symbolQuery}`);
      if (!res.ok) return;
      const data = await res.json();
      setOpenOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOpenOrders();
  }, [refreshOpenOrders]);

  const placeOrder = useCallback(async (payload: PlaceOrderPayload) => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to place order');
    return data;
  }, []);

  const cancelOrder = useCallback(async (orderId: number) => {
    const res = await apiFetch('/api/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to cancel order');
    return data;
  }, []);

  const matchOrders = useCallback(async (nextSymbol: string, markPrice: number) => {
    const res = await apiFetch('/api/orders/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: nextSymbol, markPrice }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to match orders');
    return data as { matched: number; triggeredStops: number; liquidated: number; rejected: number };
  }, []);

  return {
    openOrders,
    loading,
    refreshOpenOrders,
    placeOrder,
    cancelOrder,
    matchOrders,
  };
}
