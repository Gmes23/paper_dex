// app/test-chart/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PriceChart } from '@/components/Chart/Chart';
import { useMockWebSocket } from '@/hooks/useMockWebSocket';
import { useChartData } from '@/hooks/useChartData';  // 👈 Use the new hook
import { useTrades } from '@/hooks/useTrades';
import { usePersistedTrades } from '@/hooks/usePersistedTrades';
import type { TimeInterval } from '@/lib/chartUtils';
import type { TradeData } from '@/lib/types';
import type { MockTrade } from '@/lib/mockData';

export default function TestChartPage() {
  const [speed, setSpeed] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [persistMock, setPersistMock] = useState(false);
  const [interval, setInterval] = useState<TimeInterval>('5m');
  const [forwardMinutes, setForwardMinutes] = useState(5);
  const symbol = 'BTC_MOCK';

  // Get real-time trades from mock WebSocket
  const { trades, processTrades, resetTrades } = useTrades({ symbol, source: 'mock' });
  const { enqueue: enqueueTrades } = usePersistedTrades({
    source: 'mock',
    enabled: enabled && persistMock,
  });

  // 👇 Use the new hook that fetches historical + handles real-time
  const { candles, loading, error, refresh, lastCandleTime, lastProcessedTradeTimeMs } = useChartData({
    symbol,
    interval,
    trades  // Pass mock trades for real-time updates
  });

  const handleMockTrade = useCallback((trade: MockTrade) => {
    const tradeData: TradeData = {
      coin: symbol,
      side: trade.side === 'buy' ? 'B' : 'A',
      px: trade.price,
      sz: trade.size.toString(),
      time: trade.timeMs,
      hash: trade.id
    };
    processTrades([tradeData]);
    enqueueTrades([tradeData]);
  }, [enqueueTrades, processTrades, symbol]);

  // Connect mock WebSocket for real-time simulation
  const { fastForward, generateBatch, syncToTimeMs, isConnected } = useMockWebSocket({
    symbol,
    onTradesUpdate: handleMockTrade,
    enabled,
    speedMultiplier: speed,
    historicalCount: 0,  // 👈 Don't generate historical in mock (API will provide)
    tradeIntervalMs: 1000,
    // ~0.1% price movement per trade (peak-to-peak)
    volatility: 0.001
  });

useEffect(() => {
  console.clear();
  console.info('🔁 Chart context reset', { symbol, interval });
}, [symbol, interval]);

useEffect(() => {
  if (trades.length === 0) return;
  // console.info('📈 Latest trade', {
  //   price: latestTrade.price,
  //   size: latestTrade.size,
  //   timeMs: latestTrade.timeMs,
  //   time: latestTrade.time,
  // });
}, [trades]);

useEffect(() => {
  if (candles.length === 0) return;
  // console.info('🕯️ Latest candle', {
  //   time: new Date(lastCandle.time * 1000).toLocaleTimeString(),
  //   open: lastCandle.open,
  //   high: lastCandle.high,
  //   low: lastCandle.low,
  //   close: lastCandle.close,
  //   volume: lastCandle.volume,
  // });
}, [candles]);

useEffect(() => {
  if (!lastCandleTime) return;
  syncToTimeMs(lastCandleTime * 1000);
}, [lastCandleTime, syncToTimeMs]);

const handleIntervalChange = (next: TimeInterval) => {
  setInterval(next);
  setTimeout(() => {
    console.info('⏱️ Interval switch END', {
      interval: next,
      after: {
        candlesCount: candles.length,
        lastCandle: candles.length > 0 ? candles[candles.length - 1] : null,
        latestTrade: trades.length > 0 ? trades[0] : null,
        lastCandleTime,
        lastProcessedTradeTimeMs,
      },
    });
  }, 0);
};

  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">📊 Chart Test Environment</h1>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded bg-amber-500 text-black text-xs font-semibold">
              MOCK
            </span>
            <span className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-xs font-semibold">
              {symbol}
            </span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="bg-[#131722] p-6 rounded-lg mb-4">
          <h2 className="text-xl font-bold mb-4">Controls</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Enable/Disable */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Mock WebSocket</label>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`px-4 py-2 rounded w-full font-semibold transition ${
                  enabled 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {enabled ? '🟢 Live' : '🔴 Stopped'}
              </button>
            </div>

            {/* Persist Mock Trades */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Persist Mock</label>
              <button
                onClick={() => setPersistMock(!persistMock)}
                className={`px-4 py-2 rounded w-full font-semibold transition ${
                  persistMock
                    ? 'bg-amber-500 hover:bg-amber-600 text-black'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                {persistMock ? '💾 Saving' : '⛔ Off'}
              </button>
            </div>

            {/* Speed Control */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">
                Speed: <span className="text-white font-bold">{speed}x</span>
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="px-4 py-2 rounded w-full bg-gray-700 hover:bg-gray-600 cursor-pointer"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={50}>50x</option>
              </select>
            </div>

            {/* Fast Forward */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Fast Forward (min)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={forwardMinutes}
                  onChange={(e) => setForwardMinutes(Number(e.target.value))}
                  className="px-3 py-2 rounded w-full bg-gray-700 hover:bg-gray-600"
                />
                <button
                  onClick={() => {
                    console.info('⏩ Fast forward', { minutes: forwardMinutes });
                    fastForward(forwardMinutes);
                  }}
                  className="px-3 py-2 rounded bg-indigo-500 hover:bg-indigo-600 font-semibold transition whitespace-nowrap"
                >
                  ⏩ Go
                </button>
              </div>
            </div>

            {/* Batch Generate */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Generate</label>
              <button
                onClick={() => generateBatch(50)}
                className="px-4 py-2 rounded w-full bg-purple-500 hover:bg-purple-600 font-semibold transition"
              >
                📦 +50 Trades
              </button>
            </div>

            {/* Refresh API Data */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Refresh API</label>
              <button
                onClick={refresh}
                disabled={loading}
                className="px-4 py-2 rounded w-full bg-blue-500 hover:bg-blue-600 font-semibold transition disabled:opacity-50"
              >
                🔄 Reload
              </button>
            </div>

            {/* Reset Trades */}
            <div>
              <label className="block text-sm mb-2 text-gray-400">Reset</label>
              <button
                onClick={resetTrades}
                className="px-4 py-2 rounded w-full bg-orange-500 hover:bg-orange-600 font-semibold transition"
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 px-4 py-3 rounded bg-gray-700/50 flex justify-between items-center">
            <div>
              <span className="text-gray-400">Historical Candles:</span>{' '}
              <span className="text-white font-bold">{candles.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Real-time Trades:</span>{' '}
              <span className="text-white font-bold">{trades.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Mock WebSocket:</span>{' '}
              <span className={enabled ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? '● Live' : '○ Stopped'}
              </span>
            </div>
          </div>

          {/* Debug Panel */}
          <div className="mt-3 px-4 py-3 rounded bg-[#0f141b] border border-gray-700 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-gray-400">Interval</div>
                <div className="text-white font-mono">{interval}</div>
              </div>
              <div>
                <div className="text-gray-400">Latest Trade</div>
                <div className="text-white font-mono">
                  {trades[0]
                    ? `$${trades[0].price} @ ${new Date(trades[0].timeMs).toLocaleTimeString()}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Last Candle</div>
                <div className="text-white font-mono">
                  {candles.length > 0
                    ? new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString()
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Last Trade Processed</div>
                <div className="text-white font-mono">
                  {lastProcessedTradeTimeMs
                    ? new Date(lastProcessedTradeTimeMs).toLocaleTimeString()
                    : '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-gray-400">Last Candle OHLC</div>
                <div className="text-white font-mono">
                  {candles.length > 0
                    ? `O:${candles[candles.length - 1].open} H:${candles[candles.length - 1].high} L:${candles[candles.length - 1].low} C:${candles[candles.length - 1].close}`
                    : '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-gray-400">Last Candle Time (sec)</div>
                <div className="text-white font-mono">{lastCandleTime ?? '—'}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded">
              <p className="text-red-400">❌ {error}</p>
            </div>
          )}
        </div>

        {/* Chart - now uses real API + mock real-time updates */}
        <PriceChart
          candles={candles}
          loading={loading}
          symbol={symbol}
          interval={interval}
          onIntervalChange={handleIntervalChange}
          markPrice={null}
          openOrders={[]}
        />

        {/* Recent Trades Table */}
        <div className="bg-[#131722] p-4 rounded-lg mt-4">
          <h2 className="text-xl font-bold mb-4">📋 Recent Mock Trades (Real-time)</h2>
          <div className="overflow-auto max-h-60">
            {trades.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No trades yet. Enable mock WebSocket to generate.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#131722]">
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-2 text-gray-400">Time</th>
                    <th className="text-right p-2 text-gray-400">Price</th>
                    <th className="text-right p-2 text-gray-400">Size</th>
                    <th className="text-center p-2 text-gray-400">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 20).map((trade) => (
                    <tr key={trade.id} className="border-b border-gray-800">
                      <td className="p-2 font-mono text-xs">{trade.time}</td>
                      <td className="p-2 font-mono text-right">${trade.price}</td>
                      <td className="p-2 font-mono text-right text-gray-400">{trade.size.toFixed(5)}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
