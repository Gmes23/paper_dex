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
import { usePaperOrders } from '@/hooks/usePaperOrders';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useChartData } from '@/hooks/useChartData';

import { WS_SOURCE } from '@/lib/constants';
import type { Symbol, Tab, Denomination, TradeFormState, TradeData, OrderBookData } from '@/lib/types';
import type { TimeInterval } from '@/lib/chartUtils';
import type { MockTrade } from '@/lib/mockData';

const wsSource = WS_SOURCE;
const useLive = wsSource === 'live';
const NO_PRICE_FEED_THRESHOLD_MS = 12000;

export default function OrderBook() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [interval, setChartInterval] = useState<TimeInterval>('5m');
  const [priceGrouping, setPriceGrouping] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<Tab>('orderbook');
  const orderBookDenomination: Denomination = 'asset';
  const [tradesDenomination, setTradesDenomination] = useState<Denomination>('asset');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // In flight guards
  const matchingInFlightRef = useRef(false);
  const closingPositionIdsRef = useRef<Set<number>>(new Set());
  const cancellingOrderIdsRef = useRef<Set<number>>(new Set());



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

  const {
    connectionState: liveConnectionState,
    reconnectAttempt: liveReconnectAttempt,
  } = useWebSocket({
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
  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const bestBidRef = useRef(bestBid);
  const bestAskRef = useRef(bestAsk);
  const currentMarkPriceRef = useRef<number | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const orderBookStalenessMs =
    lastUpdateTimestamp != null
      ? Math.max(0, clockMs - lastUpdateTimestamp)
      : null;
  const noPriceFeed = orderBookStalenessMs == null || orderBookStalenessMs >= NO_PRICE_FEED_THRESHOLD_MS;
  const isMarkPriceValid = markPrice != null && Number.isFinite(markPrice) && markPrice > 0;
  const isPriceFeedAvailable = isMarkPriceValid && !noPriceFeed;
  const effectiveMarkPrice = isPriceFeedAvailable ? markPrice : null;
  const isLiveFeedTransitioning =
    useLive && (liveConnectionState === 'connecting' || liveConnectionState === 'reconnecting');
  const reconnectLabel =
    liveConnectionState === 'connecting'
      ? 'Connecting to live feed...'
      : `Reconnecting to live feed${liveReconnectAttempt > 0 ? ` (attempt ${liveReconnectAttempt})` : ''}...`;
  const orderBookAgeLabel =
    orderBookStalenessMs == null
      ? 'Updated: n/a'
      : orderBookStalenessMs < 1000
        ? `Updated: ${orderBookStalenessMs}ms ago`
        : `Updated: ${(orderBookStalenessMs / 1000).toFixed(1)}s ago`;
  const priceFeedMessage = !isPriceFeedAvailable
    ? (
      isLiveFeedTransitioning
        ? 'Reconnecting to live price feed. Order entry is disabled.'
        : 'No active price feed. Order entry is disabled until prices resume.'
    )
    : null;
  const hasOrderBookSnapshot = lastUpdateTimestamp != null;
  const showOrderBookLoadingOverlay =
    activeTab === 'orderbook' && (!hasOrderBookSnapshot || (isLiveFeedTransitioning && noPriceFeed));
  const orderBookLoadingLabel = isLiveFeedTransitioning
    ? reconnectLabel
    : `Loading ${symbol} order book...`;

  const [tradeForm, setTradeForm] = useState<TradeFormState>({
    tradeAsset: symbol,
    inputPrice: '',
    size: '',
    leverage: 10,
    activeTradeTab: 'Long',
    markPrice: null,
    PNL: null
  });
  const [tradeFormError, setTradeFormError] = useState<string | null>(null);

  const { user, refresh: refreshUser } = useWalletAuth();
  const { positions, refresh: refreshPositions, closePosition } = usePaperPositions();
  const { trades: pastTrades, refresh: refreshPastTrades } = usePaperTrades();
  const {
    openOrders,
    refreshOpenOrders,
    placeOrder,
    cancelOrder,
    matchOrders,
  } = usePaperOrders();
  const symbolOpenOrders = openOrders.filter((order) => order.symbol === symbol);
  const [markPriceBySymbol, setMarkPriceBySymbol] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (markPrice == null) return;
    setMarkPriceBySymbol((prev) => {
      if (prev[symbol] === markPrice) return prev;
      return { ...prev, [symbol]: markPrice };
    });
  }, [markPrice, symbol]);

  useEffect(() => {
    const symbolsInContext = Array.from(new Set([
      ...positions.map((position) => position.symbol),
      ...openOrders.map((order) => order.symbol),
    ]));
    const symbolsToFetch = symbolsInContext.filter((trackedSymbol) => trackedSymbol !== symbol);
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
  }, [openOrders, positions, symbol]);

  const getMarkPriceForSymbol = useCallback(
    (positionSymbol: string) => {
      if (positionSymbol === symbol) return markPrice;
      return markPriceBySymbol[positionSymbol] ?? null;
    },
    [markPrice, markPriceBySymbol, symbol]
  );

  const addPosition = useCallback(async (submission: { orderType: 'market' | 'limit'; stopLossPrice: number | null }) => {
    setTradeFormError(null);
    if (!isPriceFeedAvailable) {
      setTradeFormError('No price feed available. Reconnecting...');
      return;
    }
    const rawSize = Number(tradeForm.size);
    const inputPrice = Number(tradeForm.inputPrice);
    const referencePrice =
      submission.orderType === 'market'
        ? (markPrice ?? 0)
        : (Number.isFinite(inputPrice) && inputPrice > 0 ? inputPrice : (markPrice ?? 0));
    const positionSize =
      tradeForm.tradeAsset === 'USDC'
        ? rawSize
        : rawSize * referencePrice;

    if (!Number.isFinite(positionSize) || positionSize <= 0) {
      setTradeFormError('Please enter a valid position size.');
      return;
    }
    if (tradeForm.tradeAsset !== 'USDC' && (!Number.isFinite(referencePrice) || referencePrice <= 0)) {
      setTradeFormError('Price unavailable. Please enter a valid price.');
      return;
    }
    if (submission.orderType === 'limit' && (!Number.isFinite(inputPrice) || inputPrice <= 0)) {
      setTradeFormError('Please enter a valid limit price.');
      return;
    }

    try {
      await placeOrder({
        symbol,
        side: tradeForm.activeTradeTab === 'Long' ? 'long' : 'short',
        orderType: submission.orderType,
        positionSize,
        leverage: tradeForm.leverage,
        limitPrice: submission.orderType === 'limit' ? inputPrice : undefined,
        stopLossPrice: submission.stopLossPrice,
      });
      await Promise.all([
        refreshPositions(),
        refreshOpenOrders(),
        refreshUser(),
      ]);
      setTradeFormError(null);
    } catch (err) {
      setTradeFormError((err as Error).message ?? 'Failed to place order');
    }
  }, [
    markPrice,
    placeOrder,
    refreshOpenOrders,
    refreshPositions,
    refreshUser,
    symbol,
    tradeForm.activeTradeTab,
    tradeForm.inputPrice,
    tradeForm.leverage,
    tradeForm.size,
    tradeForm.tradeAsset,
    isPriceFeedAvailable,
  ]);

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
    const symbolsWithActivity = Array.from(new Set([
      ...openOrders.map((order) => order.symbol),
      ...positions.map((position) => position.symbol),
    ]));
    if (symbolsWithActivity.length === 0) return;

    let cancelled = false;

    const runMatch = async () => {
      if (matchingInFlightRef.current) return;
      matchingInFlightRef.current = true;


      try {
        const results = await Promise.all(
          symbolsWithActivity
            .map((orderSymbol) => {
              const price = orderSymbol === symbol ? markPrice : markPriceBySymbol[orderSymbol] ?? null;
              if (price == null || !Number.isFinite(price) || price <= 0) return null;
              return matchOrders(orderSymbol, price);
            })
            .filter((entry): entry is Promise<{ matched: number; triggeredStops: number; liquidated: number; rejected: number }> => entry != null)
        );

        if (cancelled) return;
        const hasChanges = results.some(
          (result) => result.matched > 0 || result.rejected > 0 || result.liquidated > 0
        );
        if (hasChanges) {
          await Promise.all([
            refreshPositions(),
            refreshPastTrades(),
            refreshOpenOrders(),
            refreshUser(),
          ]);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to match paper orders', err);
        }
      } finally {
        matchingInFlightRef.current = false;
      }
    };

    void runMatch();
    return () => {
      cancelled = true;
    };
  }, [markPrice, markPriceBySymbol, matchOrders, openOrders, positions, refreshOpenOrders, refreshPastTrades, refreshPositions, refreshUser, symbol]);

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
    setTradeFormError(null);
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
        markPrice={effectiveMarkPrice}
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
            markPrice={effectiveMarkPrice}
            openOrders={symbolOpenOrders}
          />

          <div className="rounded-xl border border-white/10 overflow-hidden h-[300px] min-h-[300px]">
            <PositionsTable
              userPositions={positions}
              pastTrades={pastTrades}
              openOrders={openOrders}
              getMarkPriceForSymbol={getMarkPriceForSymbol}
              onClosePosition={async (id) => {
                if (closingPositionIdsRef.current.has(id)) return;
                closingPositionIdsRef.current.add(id);
                try {
                  await closePosition(id);
                  await Promise.all([
                    refreshPositions(),
                    refreshPastTrades(),
                    refreshOpenOrders(),
                    refreshUser(),
                  ]);
                } catch (err) {
                  alert((err as Error).message ?? 'Failed to close position');
                } finally {
                  closingPositionIdsRef.current.delete(id);
                }
              }}
              onCancelOrder={async (id) => {
                if (cancellingOrderIdsRef.current.has(id)) return;
                cancellingOrderIdsRef.current.add(id);
                try {
                  await cancelOrder(id);
                  await Promise.all([
                    refreshOpenOrders(),
                    refreshUser(),
                  ]);
                } catch (err) {
                  alert((err as Error).message ?? 'Failed to cancel order');
                } finally {
                  cancellingOrderIdsRef.current.add(id);
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
                  className={`transition cursor-pointer ${activeTab === 'orderbook'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-white'
                    }`}
                >
                  Order Book
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trades')}
                  className={`transition cursor-pointer ${activeTab === 'trades'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-white'
                    }`}
                >
                  Trades
                </button>

              </div>
              <span className="text-[10px] text-gray-500 tabular-nums">
                {orderBookAgeLabel}
              </span>
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {activeTab === 'orderbook' ? (
                  <OrderBookTable
                    fixedAsks={fixedAsks}
                    fixedBids={fixedBids}
                    spread={spread}
                    markPrice={effectiveMarkPrice}
                    maxAskTotal={orderBookDenomination === 'asset' ? maxAskTotal.asset : maxAskTotal.usdc}
                    maxBidTotal={orderBookDenomination === 'asset' ? maxBidTotal.asset : maxBidTotal.usdc}
                    denomination={orderBookDenomination}
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
              {showOrderBookLoadingOverlay ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0d1117]/75 backdrop-blur-[1px]">
                  <div className="rounded-lg border border-white/15 bg-[#111723] px-4 py-3 text-center">
                    <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
                    <p className="text-xs uppercase tracking-wide text-gray-200">
                      {orderBookLoadingLabel}
                    </p>
                  </div>
                </div>
              ) : null}
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
              onClearFormError={() => setTradeFormError(null)}
              formError={tradeFormError}
              tradeForm={tradeForm}
              onPositionSubmit={addPosition}
              currentMarkPrice={effectiveMarkPrice}
              isPriceFeedAvailable={isPriceFeedAvailable}
              priceFeedMessage={priceFeedMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
