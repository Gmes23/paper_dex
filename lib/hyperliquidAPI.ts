// lib/hyperliquidAPI.ts

export interface HyperliquidCandle {
    T: number;  // End time (ms)
    c: string;  // Close
    h: string;  // High
    i: string;  // Interval
    l: string;  // Low
    n: number;  // Number of trades
    o: string;  // Open
    s: string;  // Symbol
    t: number;  // Start time (ms)
    v: string;  // Volume
  }
  
  export interface Candle {
    time: number;     // Unix timestamp in seconds (for Lightweight Charts)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }
  
  /**
   * Fetch historical candles from Hyperliquid
   */
  export async function fetchHistoricalCandles(
    coin: string,
    interval: string,
    limit: number = 500
  ): Promise<Candle[]> {
    try {
      // Calculate time range
      const endTime = Date.now();
      const intervalMs = getIntervalMs(interval);
      const startTime = endTime - (intervalMs * limit);
  
      console.log(`📊 Fetching ${limit} ${interval} candles for ${coin}...`);
  
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: coin,
            interval: interval,
            startTime: startTime,
            endTime: endTime
          }
        })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
  
      const data: HyperliquidCandle[] = await response.json();
  
      console.log(`✅ Received ${data.length} candles`);
  
      // Transform to our format
      const candles: Candle[] = data.map(candle => ({
        time: Math.floor(candle.t / 1000), // Convert ms to seconds
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v)
      }));
  
      // Sort by time (should already be sorted, but just in case)
      candles.sort((a, b) => a.time - b.time);
  
      return candles;
    } catch (error) {
      console.error('❌ Failed to fetch historical candles:', error);
      return [];
    }
  }
  
  /**
   * Get interval duration in milliseconds
   */
  function getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000, // Approximate
    };
    return map[interval] || 60 * 1000;
  }