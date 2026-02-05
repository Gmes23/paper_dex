// hooks/useOrderBookState.tsx
'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { NUM_ROWS } from '@/lib/constants';
import type { OrderBookData, ProcessedLevel, Symbol } from '@/lib/types';

interface UseOrderBookStateProps {
  symbol: Symbol;
  priceGrouping: number;
}

interface ProcessedDataProps {
  bids: ProcessedLevel[];
  asks: ProcessedLevel[];
  bestBid: number;
  bestAsk: number;
  spread: { value: number; percentage: number } | null;
  maxBidTotal: { asset: number; usdc: number };
  maxAskTotal: { asset: number; usdc: number };
}
export function useOrderBookState({
  symbol,
  priceGrouping
}: UseOrderBookStateProps) {

  // ✅ ONLY store worker results
  const [processedData, setProcessedData] = useState< ProcessedDataProps| null>(null);

  const workerRef = useRef<Worker | null>(null);
  const currentSymbolRef = useRef<string>(symbol);

  //fallback for error 
  const [workerError, setWorkError] = useState<string | null>(null);

  //track if worker is in progress
  const isProcessingRef = useRef(false);

  //store the most recent data while worker is busy
  const pendingDataRef = useRef<OrderBookData | null>(null);
  const priceGroupingRef = useRef(priceGrouping);

  useEffect(() => {
    priceGroupingRef.current = priceGrouping;
  }, [priceGrouping]);


  // ✅ Create worker once
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

        //why process it now?
        isProcessingRef.current = true;
        workerRef.current?.postMessage({
          rawBids: dataToProcess.levels[0],
          rawAsks: dataToProcess.levels[1],
          priceGrouping: priceGroupingRef.current,
          symbol: currentSymbolRef.current
        })
      }
    };

    workerRef.current.onerror = (error) => {
      console.error('Worker Error:', error);
      setWorkError("Calculating engine failed. Using fallback...")
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // ✅ Send data to worker (NO processing here!)
  const processOrderBook = useCallback((data: OrderBookData) => {
    if (data.coin !== currentSymbolRef.current) return;

    if(isProcessingRef.current) {
      pendingDataRef.current = data;
      return;
    }

    isProcessingRef.current = true;
    workerRef.current?.postMessage({
      rawBids: data.levels[0],
      rawAsks: data.levels[1],
      priceGrouping: priceGroupingRef.current,
      symbol: currentSymbolRef.current
    });
  }, [priceGrouping]);

  // ✅ Update symbol reference
  useEffect(() => {
    currentSymbolRef.current = symbol;
    setProcessedData(null); // Clear old data
    pendingDataRef.current = null;
    isProcessingRef.current = false;
  }, [symbol]);

  // ✅ Format for display (cheap operation, OK on main thread)
  const fixedAsks = useMemo(() => {
    if (!processedData) return Array(NUM_ROWS).fill(null);

    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    processedData.asks.forEach((ask, i) => {
      rows[NUM_ROWS - 1 - i] = ask;
    });
    return rows;
  }, [processedData?.asks]);

  const fixedBids = useMemo(() => {
    if (!processedData) return Array(NUM_ROWS).fill(null);

    const rows: (ProcessedLevel | null)[] = Array(NUM_ROWS).fill(null);
    processedData.bids.forEach((bid, i) => {
      rows[NUM_ROWS - 1 - i] = bid;
    });
    return rows;
  }, [processedData?.bids]);



  // ✅ Return worker results
  return {
    bids: processedData?.bids || [],
    asks: processedData?.asks || [],
    fixedBids,
    fixedAsks,
    bestBid: processedData?.bestBid || null,
    bestAsk: processedData?.bestAsk || null,
    spread: processedData?.spread || null,
    maxBidTotal: processedData?.maxBidTotal || { asset: 0, usdc: 0 },
    maxAskTotal: processedData?.maxAskTotal || { asset: 0, usdc: 0 },
    processOrderBook,
    error: workerError
  };
}