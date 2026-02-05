'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OrderBookHeader } from '@/components/OrderBook/OrderBookHeader';
import { OrderBookTable } from '@/components/OrderBook/OrderBookTable';
import { TradesTable } from '@/components/OrderBook/TradesTable';
import { TradeTab } from '@/components/TradeTab/TradeTab';
import { PositionsTable } from '@/components/PositionsTable/PositionsTable';
import { PriceChart } from '@/components/Chart/Chart';


import { useWebSocket } from '@/hooks/useWebSocket';
import { useOrderBookState } from '@/hooks/useOrderBookState';
import { useTrades } from '@/hooks/useTrades';

import type { Symbol, Tab, Denomination, TradeFormState, Position } from '@/lib/types';

export default function OrderBook() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [priceGrouping, setPriceGrouping] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<Tab>('orderbook');
  const [denomination, setDenomination] = useState<Denomination>('asset');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Custom hooks
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

  const { trades, processTrades, resetTrades } = useTrades({ symbol });

  const { isConnected } = useWebSocket({
    symbol,
    onOrderBookUpdate: processOrderBook,
    onTradesUpdate: processTrades
  });

  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const bestBidRef = useRef(bestBid);
  const bestAskRef = useRef(bestAsk);


  const currentMarkPriceRef = useRef<number | null>(null);


  //User positions
  const [userPositionData, setUserPositionData] =
    useState<Position[]>([]);

  //state for when buy/selling TradeTab
  const [tradeForm, setTradeForm] = useState<TradeFormState>({
    tradeAsset: symbol,
    inputPrice: '',
    size: '',
    activeTradeTab: 'Long',
    markPrice: null,
    PNL: null
  });

  const [positionsPNL, setPositionsPNL] = useState<(number | string)[] | null>(null);


  //actually we should throttle this, or rather wait until user finish making changees? 
  const addPosition = useCallback(() => {
    const position = {
      id: `${Date.now()}-0x${Math.random().toString(36).substring(2, 9)}`,
      date: Date.now(),
      ...tradeForm
    }
    setUserPositionData(prevState => [...prevState, position])
  }, [tradeForm]);

  useEffect(() => {
    bestBidRef.current = bestBid;
    bestAskRef.current = bestAsk;
  }, [bestBid, bestAsk]);


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

  useEffect(() => {

    const useTrottleId = setInterval(() => {
      console.log(bestBidRef.current)

      if (bestBidRef.current && bestAskRef.current) {

        currentMarkPriceRef.current = (bestBidRef.current + bestAskRef.current) / 2;

        setMarkPrice(currentMarkPriceRef.current);

        if (userPositionData && currentMarkPriceRef.current !== null) {
          const pnl = userPositionData.map((position) => {

            const checkValid = (currentMarkPriceRef.current ?? "N/A")
            const profit = checkValid !== "N/A" ? checkValid - parseInt(position.inputPrice) : "N/A";
            return profit;
          })
          setPositionsPNL(pnl)
          console.log(positionsPNL)
        }
      }
    }, 500)

    return () => {
      clearInterval(useTrottleId);
    }
    // i have hard time always thinking what depency is needed for my hooks?
  }, [userPositionData])

  const callbackTradeForm = useCallback((value: Partial<TradeFormState>) => {
    setTradeForm(prevState => ({ ...prevState, ...value }))
  }, [])


  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-4">




      <div className="grid grid-cols-2 gap-0">

        <div>
          <PriceChart
            trades={trades}
            symbol={symbol}

          />
          <PositionsTable
            userPositions={userPositionData}
            markPrice={markPrice}
            positionsPNL={positionsPNL}
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
          />

          {/* Footer */}
          <div className="mt-4 text-center text-xs text-gray-600">
            {isConnected ? (
              <span className="text-green-500">● Live</span>
            ) : (
              <span className="text-red-500">● Disconnected</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}