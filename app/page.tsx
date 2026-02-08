'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OrderBookHeader } from '@/components/OrderBook/OrderBookHeader';
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
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useChartData } from '@/hooks/useChartData';

import { WS_SOURCE } from '@/lib/constants';
import type { Symbol, Tab, Denomination, TradeFormState, TradeData, OrderBookData } from '@/lib/types';
import type { TimeInterval } from '@/lib/chartUtils';

// ????? this can be better place?
const wsSource = WS_SOURCE;
const useLive = wsSource === 'live';


export default function OrderBook() {

  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [interval, setInterval] = useState<TimeInterval>('5m');
  const [priceGrouping, setPriceGrouping] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<Tab>('orderbook');
  const [denomination, setDenomination] = useState<Denomination>('asset');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const {
    fixedBids,
    fixedAsks,
    bestBid,
    bestAsk,
    spread,
    maxBidTotal,
    maxAskTotal,
    processOrderBook,
    error
  } = useOrderBookState({ symbol, priceGrouping });


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

  const { isConnected: liveConnected } = useWebSocket({
    symbol,
    onOrderBookUpdate: handleOrderBook,
    onTradesUpdate: handleTrades,
    enabled: useLive,
  });

  const { isConnected: mockConnected } = useMockWebSocket({
    symbol,
    onTradesUpdate: (trade) => {
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
    onOrderBookUpdate: (orderBook) => {
      handleOrderBook(orderBook as OrderBookData);
    },
    enabled: !useLive,
    historicalCount: 0,
    tradeIntervalMs: 700,
    volatility: 0.01,
  });

  const isConnected = useLive ? liveConnected : mockConnected;

  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const bestBidRef = useRef(bestBid);
  const bestAskRef = useRef(bestAsk);


  const currentMarkPriceRef = useRef<number | null>(null);


  //state for when buy/selling TradeTab
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

  const addPosition = useCallback(async () => {
    const positionSize = Number(tradeForm.size);
    if (!Number.isFinite(positionSize) || positionSize <= 0) {
      alert('Enter a valid position size');
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
  }, [openPosition, refreshUser, symbol, tradeForm.activeTradeTab, tradeForm.leverage, tradeForm.size]);

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
  }, [processOrderBook, symbol, wsSource]);

  useEffect(() => {
    setTradeForm(prevState => ({
      ...prevState,
      tradeAsset: prevState.tradeAsset !== 'USDC' ? symbol : 'USDC'
    }));
  }, [symbol]);

  // Reset trades when symbol changes
  useEffect(() => {
    resetTrades();
    setPriceGrouping(symbol === 'BTC' ? 1 : 0.1);
  }, [symbol, resetTrades]);

  const callbackTradeForm = useCallback((value: Partial<TradeFormState>) => {
    setTradeForm(prevState => ({ ...prevState, ...value }))
  }, [])


  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-4">
      <div className="grid grid-cols-2 gap-0">

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-3 py-1 rounded text-xs font-semibold ${useLive ? 'bg-green-500 text-black' : 'bg-amber-500 text-black'
                }`}
            >
              {useLive ? 'LIVE' : 'MOCK'}
            </span>
            <span className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-xs font-semibold">
              {symbol}
            </span>
          </div>
          <PriceChart
            candles={candles}
            loading={candlesLoading}
            symbol={symbol}
            interval={interval}
            onIntervalChange={setInterval}
          />
          <PositionsTable
            userPositions={positions}
            markPrice={markPrice}
            onClosePosition={async (id) => {
              try {
                await closePosition(id);
                await refreshUser();
              } catch (err) {
                alert((err as Error).message ?? 'Failed to close position');
              }
            }}
          />
        </div>



        <div className="max-w-l mx-[2.75rem]">
          <OrderBookHeader
            symbol={symbol}
            setSymbol={setSymbol}
            priceGrouping={priceGrouping}
            setPriceGrouping={setPriceGrouping}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            denomination={denomination}
            setDenomination={setDenomination}
            isConnected={isConnected}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />

          {activeTab === 'orderbook' ? (
            <OrderBookTable
              fixedAsks={fixedAsks}
              fixedBids={fixedBids}
              spread={spread}
              maxAskTotal={denomination === 'asset' ? maxAskTotal.asset : maxAskTotal.usdc}
              maxBidTotal={denomination === 'asset' ? maxBidTotal.asset : maxBidTotal.usdc}
              denomination={denomination}
              symbol={symbol}
              error={error}
              onPriceSelect={(price) => callbackTradeForm({ inputPrice: price })}
            />
          ) : (
            <TradesTable
              trades={trades}
              denomination={denomination}
              symbol={symbol}
            />
          )}

          <TradeTab
            symbol={symbol}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            onTradeFormChange={callbackTradeForm}
            tradeForm={tradeForm}
            onPositionSubmit={addPosition}
            availableBalance={user?.availableBalance ?? 0}
            currentMarkPrice={markPrice}
          />

          {/* Footer */}
          <div className="mt-4 text-center text-xs text-gray-600">
            {isConnected ? (
              <span className="font-pixel-grid text-green-500 text-2xl">● Live</span>
            ) : (
              <span className="text-red-500">● Disconnected</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
