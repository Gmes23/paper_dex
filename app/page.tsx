'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { OrderBookTable } from '@/components/OrderBook/OrderBookTable';
import { TradesTable } from '@/components/OrderBook/TradesTable';
import { TradeTab } from '@/components/TradeTab/TradeTab';
import { PositionsTable } from '@/components/PositionsTable/PositionsTable';
import { PriceChart } from '@/components/Chart/Chart';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useMockWebSocket } from '@/hooks/useMockWebSocket';
import { usePersistedTrades } from '@/hooks/usePersistedTrades';
import { usePersistedOrderBook } from '@/hooks/usePersistedOrderBook';
import { useOrderBookState } from '@/hooks/useOrderBookState';
import { useTrades } from '@/hooks/useTrades';
import { usePaperPositions } from '@/hooks/usePaperPositions';
import { usePaperTrades } from '@/hooks/usePaperTrades';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useChartData } from '@/hooks/useChartData';

import { WS_SOURCE } from '@/lib/constants';
import type { Symbol, Tab, Denomination, TradeFormState, TradeData, OrderBookData } from '@/lib/types';
import type { TimeInterval } from '@/lib/chartUtils';
import type { MockTrade } from '@/lib/mockData';

const wsSource = WS_SOURCE;
const useLive = wsSource === 'live';

export default function OrderBook() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [interval, setChartInterval] = useState<TimeInterval>('5m');
  const [priceGrouping, setPriceGrouping] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<Tab>('orderbook');
  const orderBookDenomination: Denomination = 'asset';
  const [tradesDenomination, setTradesDenomination] = useState<Denomination>('asset');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const {
    fixedBids,
    fixedAsks,
    bestBid,
    bestAsk,
    spread,
    maxBidTotal,
    maxAskTotal,
    lastUpdateTimestamp,
    processOrderBook,
    error
  } = useOrderBookState({
    symbol,
    priceGrouping,
    workerDebounceMs: 10,
  });

  const { trades, processTrades, resetTrades } = useTrades({
    symbol,
    source: useLive ? 'live' : 'mock',
  });
  const { candles, loading: candlesLoading } = useChartData({
    symbol,
    interval,
    trades,
  });

  const { enqueue: enqueueTrades } = usePersistedTrades({
    source: wsSource,
    enabled: !useLive,
  });

  const { enqueue: enqueueOrderBook } = usePersistedOrderBook({
    source: wsSource,
    enabled: !useLive,
  });

  const handleTrades = useCallback(
    (tradeData: TradeData[]) => {
      processTrades(tradeData);
      enqueueTrades(tradeData);
    },
    [enqueueTrades, processTrades]
  );

  const handleOrderBook = useCallback(
    (data: OrderBookData) => {
      processOrderBook(data);
      enqueueOrderBook(data);
    },
    [enqueueOrderBook, processOrderBook]
  );

  const handleMockTradesUpdate = useCallback(
    (trade: MockTrade) => {
      const tradeData: TradeData = {
        coin: symbol,
        side: trade.side === 'buy' ? 'B' : 'A',
        px: trade.price,
        sz: trade.size.toString(),
        time: trade.timeMs,
        hash: trade.id,
      };
      handleTrades([tradeData]);
    },
    [handleTrades, symbol]
  );

  const handleMockOrderBookUpdate = useCallback(
    (orderBook: OrderBookData) => {
      handleOrderBook(orderBook);
    },
    [handleOrderBook]
  );

  useWebSocket({
    symbol,
    onOrderBookUpdate: handleOrderBook,
    onTradesUpdate: handleTrades,
    enabled: useLive,
  });

  useMockWebSocket({
    symbol,
    onTradesUpdate: handleMockTradesUpdate,
    onOrderBookUpdate: handleMockOrderBookUpdate,
    enabled: !useLive,
    historicalCount: 0,
    tradeIntervalMs: 700,
    volatility: 0.01,
  });
  const orderBookStalenessMs =
    lastUpdateTimestamp != null
      ? Math.max(0, Date.now() - lastUpdateTimestamp)
      : null;

  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const bestBidRef = useRef(bestBid);
  const bestAskRef = useRef(bestAsk);
  const currentMarkPriceRef = useRef<number | null>(null);

  const [tradeForm, setTradeForm] = useState<TradeFormState>({
    tradeAsset: symbol,
    inputPrice: '',
    size: '',
    leverage: 10,
    activeTradeTab: 'Long',
    markPrice: null,
    PNL: null
  });

  const { user, refresh: refreshUser } = useWalletAuth();
  const { positions, openPosition, closePosition } = usePaperPositions();
  const { trades: pastTrades, refresh: refreshPastTrades } = usePaperTrades();
  const [markPriceBySymbol, setMarkPriceBySymbol] = useState<Record<string, number>>({});

  useEffect(() => {
    if (markPrice == null) return;
    setMarkPriceBySymbol((prev) => {
      if (prev[symbol] === markPrice) return prev;
      return { ...prev, [symbol]: markPrice };
    });
  }, [markPrice, symbol]);

  useEffect(() => {
    const symbolsInPositions = Array.from(new Set(positions.map((position) => position.symbol)));
    const symbolsToFetch = symbolsInPositions.filter((positionSymbol) => positionSymbol !== symbol);
    if (symbolsToFetch.length === 0) return;

    let cancelled = false;

    const refreshMarks = async () => {
      const updates: Record<string, number> = {};

      await Promise.all(
        symbolsToFetch.map(async (positionSymbol) => {
          try {
            const res = await fetch(`/api/candles?symbol=${positionSymbol}&interval=1m&limit=1`, {
              cache: 'no-store',
            });
            if (!res.ok) return;
            const data = (await res.json()) as { candles?: Array<{ close?: number | string }> } | null;
            const candles = Array.isArray(data?.candles) ? data.candles : [];
            const latest = candles[candles.length - 1];
            const close = Number(latest?.close);
            if (!Number.isFinite(close) || close <= 0) return;
            updates[positionSymbol] = close;
          } catch {
            // best-effort only; leave previous mark if fetch fails
          }
        })
      );

      if (cancelled || Object.keys(updates).length === 0) return;
      setMarkPriceBySymbol((prev) => ({ ...prev, ...updates }));
    };

    void refreshMarks();
    const timer = setInterval(() => {
      void refreshMarks();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [positions, symbol]);

  const getMarkPriceForSymbol = useCallback(
    (positionSymbol: string) => {
      if (positionSymbol === symbol) return markPrice;
      return markPriceBySymbol[positionSymbol] ?? null;
    },
    [markPrice, markPriceBySymbol, symbol]
  );

  const addPosition = useCallback(async () => {
    const rawSize = Number(tradeForm.size);
    const inputPrice = Number(tradeForm.inputPrice);
    const referencePrice =
      Number.isFinite(inputPrice) && inputPrice > 0
        ? inputPrice
        : (markPrice ?? 0);
    const positionSize =
      tradeForm.tradeAsset === 'USDC'
        ? rawSize
        : rawSize * referencePrice;

    if (!Number.isFinite(positionSize) || positionSize <= 0) {
      alert('Enter a valid position size');
      return;
    }
    if (tradeForm.tradeAsset !== 'USDC' && (!Number.isFinite(referencePrice) || referencePrice <= 0)) {
      alert('Price unavailable. Please enter a valid price.');
      return;
    }

    try {
      await openPosition({
        symbol,
        side: tradeForm.activeTradeTab === 'Long' ? 'long' : 'short',
        positionSize,
        leverage: tradeForm.leverage,
      });
      await refreshUser();
    } catch (err) {
      alert((err as Error).message ?? 'Failed to open position');
    }
  }, [markPrice, openPosition, refreshUser, symbol, tradeForm.activeTradeTab, tradeForm.inputPrice, tradeForm.leverage, tradeForm.size, tradeForm.tradeAsset]);

  useEffect(() => {
    bestBidRef.current = bestBid;
    bestAskRef.current = bestAsk;
  }, [bestBid, bestAsk]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (bestBidRef.current != null && bestAskRef.current != null) {
        currentMarkPriceRef.current = (bestBidRef.current + bestAskRef.current) / 2;
        setMarkPrice(currentMarkPriceRef.current);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOrderBookSnapshot() {
      try {
        const res = await fetch(
          `/api/orderbook?symbol=${symbol}&source=${wsSource}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as OrderBookData | null;
        if (!data || cancelled) return;
        processOrderBook(data);
      } catch (err) {
        console.warn('Failed to load orderbook snapshot', err);
      }
    }

    loadOrderBookSnapshot();

    return () => {
      cancelled = true;
    };
  }, [processOrderBook, symbol]);

  useEffect(() => {
    setTradeForm(prevState => ({
      ...prevState,
      tradeAsset: prevState.tradeAsset !== 'USDC' ? symbol : 'USDC'
    }));
  }, [symbol]);

  useEffect(() => {
    resetTrades();
    setPriceGrouping(symbol === 'BTC' ? 1 : 0.1);
  }, [symbol, resetTrades]);

  const callbackTradeForm = useCallback((value: Partial<TradeFormState>) => {
    setTradeForm(prevState => ({ ...prevState, ...value }))
  }, [])

  const toggleTradesDenomination = useCallback(() => {
    setTradesDenomination((prev) => (prev === 'asset' ? 'usdc' : 'asset'));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#0a0e13] text-white overflow-hidden">
      {/* Navbar */}
      <Navbar
        symbol={symbol}
        markPrice={markPrice}
        availableBalance={user?.availableBalance ?? 0}
        onSymbolChange={setSymbol}
        symbolOptions={['BTC', 'ETH']}
      />

      {/* Main content: 3 columns */}
      <div className="flex-1 flex min-h-0">
        {/* Left column: Chart + Positions */}
        <div className="flex-1 flex flex-col min-w-0 border-white/5 px-3 pt-3 pb-3 gap-3">
          <PriceChart
            candles={candles}
            loading={candlesLoading}
            symbol={symbol}
            interval={interval}
            onIntervalChange={setChartInterval}
            markPrice={markPrice}
          />

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <PositionsTable
              userPositions={positions}
              pastTrades={pastTrades}
              getMarkPriceForSymbol={getMarkPriceForSymbol}
              onClosePosition={async (id) => {
                try {
                  await closePosition(id);
                  await refreshPastTrades();
                  await refreshUser();
                } catch (err) {
                  alert((err as Error).message ?? 'Failed to close position');
                }
              }}
            />
          </div>
        </div>

        {/* Middle column: Order Book */}
        <div className="w-[280px] flex-shrink-0 px-1 pt-3 pb-3 flex flex-col">
          <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden h-[720px] flex flex-col">
            <div className="px-3 py-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setActiveTab('orderbook')}
                  className={`transition cursor-pointer ${
                    activeTab === 'orderbook'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Order Book
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trades')}
                  className={`transition cursor-pointer ${
                    activeTab === 'trades'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Trades
                </button>

              </div>
              <span className="text-[10px] text-gray-500 tabular-nums">
                Updated: {orderBookStalenessMs != null ? `${orderBookStalenessMs}ms ago` : 'n/a'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'orderbook' ? (
                <OrderBookTable
                  fixedAsks={fixedAsks}
                  fixedBids={fixedBids}
                  spread={spread}
                  maxAskTotal={orderBookDenomination === 'asset' ? maxAskTotal.asset : maxAskTotal.usdc}
                  maxBidTotal={orderBookDenomination === 'asset' ? maxBidTotal.asset : maxBidTotal.usdc}
                  denomination={orderBookDenomination}
                  symbol={symbol}
                  error={error}
                  onPriceSelect={(price) => callbackTradeForm({ inputPrice: price })}
                />
              ) : (
                <TradesTable
                  trades={trades}
                  denomination={tradesDenomination}
                  symbol={symbol}
                  onToggleDenomination={toggleTradesDenomination}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right column: Place Order */}
        <div className="w-[260px] flex-shrink-0 px-1 pt-3 pb-3 pr-3 flex flex-col">
          <div className="rounded-xl border border-white/10 bg-[#0d1117] p-3 pt-4 h-[720px] overflow-hidden">
            <TradeTab
              symbol={symbol}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onTradeFormChange={callbackTradeForm}
              tradeForm={tradeForm}
              onPositionSubmit={addPosition}
              currentMarkPrice={markPrice}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
