// hooks/useOrderBookState.tsx
'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { NUM_ROWS } from '@/lib/constants';
import type { OrderBookData, ProcessedLevel, Symbol } from '@/lib/types';

interface UseOrderBookStateProps {
  symbol: Symbol;
  priceGrouping: number;
  workerDebounceMs?: number;
}

interface ProcessedDataProps {
  bids: ProcessedLevel[];
  asks: ProcessedLevel[];
  bestBid: number;
  bestAsk: number;
  spread: { value: number; percentage: number } | null;
  maxBidTotal: { asset: number; usdc: number };
  maxAskTotal: { asset: number; usdc: number };
  symbol: string;
  timestamp: number;
}
export function useOrderBookState({
  symbol,
  priceGrouping,
  workerDebounceMs = 50,
}: UseOrderBookStateProps) {

  const [processedData, setProcessedData] = useState< ProcessedDataProps| null>(null);

  const workerRef = useRef<Worker | null>(null);
  const currentSymbolRef = useRef<string>(symbol);

  const [workerError, setWorkError] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const pendingDataRef = useRef<OrderBookData | null>(null);
  const latestDataRef = useRef<OrderBookData | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceGroupingRef = useRef(priceGrouping);
  const workerDebounceRef = useRef(Math.max(0, workerDebounceMs));

  useEffect(() => {
    priceGroupingRef.current = priceGrouping;
  }, [priceGrouping]);

  useEffect(() => {
    workerDebounceRef.current = Math.max(0, workerDebounceMs);
  }, [workerDebounceMs]);

  const postToWorker = useCallback((data: OrderBookData) => {
    isProcessingRef.current = true;
    workerRef.current?.postMessage({
      rawBids: data.levels[0],
      rawAsks: data.levels[1],
      priceGrouping: priceGroupingRef.current,
      symbol: currentSymbolRef.current
    });
  }, []);

  const flushLatestData = useCallback(() => {
    debounceTimerRef.current = null;

    const dataToProcess = latestDataRef.current;
    latestDataRef.current = null;

    if (!dataToProcess) return;
    if (dataToProcess.coin !== currentSymbolRef.current) return;

    if (isProcessingRef.current) {
      pendingDataRef.current = dataToProcess;
      return;
    }

    postToWorker(dataToProcess);
  }, [postToWorker]);


  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/orderbook.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (e) => {
      if (e.data.symbol !== currentSymbolRef.current) {
        console.warn("Ignoring stale worker result for", e.data.symbol);
        return;
      }
      setProcessedData(e.data);
      isProcessingRef.current = false;

      if(pendingDataRef.current) {
        const dataToProcess = pendingDataRef.current;
        pendingDataRef.current = null;
        postToWorker(dataToProcess);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error('Worker Error:', error);
      setWorkError("Calculating engine failed. Using fallback...")
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [postToWorker]);

  const processOrderBook = useCallback((data: OrderBookData) => {
    if (data.coin !== currentSymbolRef.current) return;

    latestDataRef.current = data;

    if (debounceTimerRef.current) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      flushLatestData();
    }, workerDebounceRef.current);
  }, [flushLatestData]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    currentSymbolRef.current = symbol;
    pendingDataRef.current = null;
    latestDataRef.current = null;
    isProcessingRef.current = false;
  }, [symbol]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      latestDataRef.current = null;
    };
  }, []);

  const visibleProcessedData =
    processedData?.symbol === symbol ? processedData : null;

  const fixedAsks = useMemo(() => {
    if (!visibleProcessedData) return Array(NUM_ROWS).fill(null);

    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    visibleProcessedData.asks.forEach((ask, i) => {
      rows[NUM_ROWS - 1 - i] = ask;
    });
    return rows;
  }, [visibleProcessedData]);

  const fixedBids = useMemo(() => {
    if (!visibleProcessedData) return Array(NUM_ROWS).fill(null);

    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    visibleProcessedData.bids.forEach((bid, i) => {
      rows[NUM_ROWS - 1 - i] = bid;
    });
    return rows;
  }, [visibleProcessedData]);


  return {
    bids: visibleProcessedData?.bids || [],
    asks: visibleProcessedData?.asks || [],
    fixedBids,
    fixedAsks,
    bestBid: visibleProcessedData?.bestBid || null,
    bestAsk: visibleProcessedData?.bestAsk || null,
    spread: visibleProcessedData?.spread || null,
    maxBidTotal: visibleProcessedData?.maxBidTotal || { asset: 0, usdc: 0 },
    maxAskTotal: visibleProcessedData?.maxAskTotal || { asset: 0, usdc: 0 },
    lastUpdateTimestamp: visibleProcessedData?.timestamp ?? null,
    processOrderBook,
    error: workerError
  };
}
