// app/test-chart/page.tsx
'use client';

import { useState, useEffect} from 'react';
import { PriceChart } from '@/components/Chart/Chart';
import { useMockWebSocket } from '@/hooks/useMockWebSocket';
import { useChartData } from '@/hooks/useChartData';  // 👈 Use the new hook
import { useTrades } from '@/hooks/useTrades';
import type { TimeInterval } from '@/lib/chartUtils';

export default function TestChartPage() {
  const [speed, setSpeed] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState<TimeInterval>('5m');
  const symbol = 'BTC';

  // Get real-time trades from mock WebSocket
  const { trades, processTrades, resetTrades } = useTrades({ symbol });

    // 👇 ADD THIS DEBUG
    console.log('📄 TestChartPage render:', {
      symbol,
      interval,
      tradesCount: trades.length
    });
  

  // 👇 Use the new hook that fetches historical + handles real-time
  const { candles, loading, error, refresh } = useChartData({
    symbol,
    interval,
    trades  // Pass mock trades for real-time updates
  });
  // 👇 ADD THIS DEBUG
  console.log('📊 useChartData returned:', {
    candlesCount: candles.length,
    loading,
    error,
    firstCandle: candles[0],
    lastCandle: candles[candles.length - 1]
  });


  // Connect mock WebSocket for real-time simulation
  const { fastForward, generateBatch, isConnected } = useMockWebSocket({
    symbol,
    onTradesUpdate: (trade) => {
      const tradeData = {
        coin: symbol,
        side: trade.side === 'buy' ? 'B' : 'A',
        px: trade.price,
        sz: trade.size.toString(),
        time: trade.timeMs,
        hash: trade.id
      } as any;
      processTrades([tradeData]);
    },
    enabled,
    speedMultiplier: speed,
    historicalCount: 0,  // 👈 Don't generate historical in mock (API will provide)
    tradeIntervalMs: 2000
  });

  // In your page or test-chart component
useEffect(() => {
  console.log('📈 Trades updated:', trades.length, 'trades');
  if (trades.length > 0) {
    console.log('Latest trade:', trades[trades.length - 1]);
  }
}, [trades]);

useEffect(() => {
  console.log('🕯️ Candles updated:', candles.length, 'candles');
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    console.log('Latest candle:', {
      time: new Date(lastCandle.time * 1000).toLocaleTimeString(),
      ohlc: `O:${lastCandle.open} H:${lastCandle.high} L:${lastCandle.low} C:${lastCandle.close}`,
      volume: lastCandle.volume
    });
  }
}, [candles]);

  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">📊 Chart Test Environment</h1>
        
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

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded">
              <p className="text-red-400">❌ {error}</p>
            </div>
          )}
        </div>

        {/* Chart - now uses real API + mock real-time updates */}
        <PriceChart 
          candles={candles}
          loading={false}
          symbol={symbol}
          interval={interval}
          onIntervalChange={setInterval}
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