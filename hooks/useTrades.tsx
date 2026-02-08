'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TradeData, ProcessedTrade, Symbol } from '@/lib/types';
import { MAX_TRADES } from '@/lib/constants';
import { apiFetch } from '@/lib/apiFetch';

interface UseTradesProps {
  symbol: Symbol;
  source?: 'mock' | 'live';
}

export function useTrades({ symbol, source }: UseTradesProps) {
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
      const timeMs = trade.time;

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
        timeMs,
        id,
      };
    });

    setTrades(prev => [...newTrades, ...prev].slice(0, MAX_TRADES));
  }, []);

  const resetTrades = useCallback(() => {
    setTrades([]);
    tradeIdCounterRef.current = 0;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadHistorical() {
      try {
        const sourceParam = source ? `&source=${source}` : '';
        const res = await apiFetch(`/api/trades?symbol=${symbol}&limit=${MAX_TRADES}${sourceParam}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data = (await res.json()) as TradeData[];
        if (cancelled || data.length === 0) return;

        setTrades([]);
        tradeIdCounterRef.current = 0;
        processTrades(data);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.warn('Failed to load historical trades', err);
      }
    }

    loadHistorical();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, processTrades, source]);

  // Update current symbol ref
  currentSymbolRef.current = symbol;

  return { trades, processTrades, resetTrades };
}
