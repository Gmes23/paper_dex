// lib/mockData.ts

export interface MockTrade {
    price: string;
    size: number;
    side: 'buy' | 'sell';
  
    // keep the ISO string (your existing feature)
    time: string;
  
    // ✅ ADD: numeric time (ms since epoch) for candle bucketing
    timeMs: number;
  
    id: string;
  }
  
  export interface MockOrderBookLevel {
    px: string;
    sz: string;
    n: number;
  }
  
  export interface MockOrderBookData {
    coin: string;
    levels: [MockOrderBookLevel[], MockOrderBookLevel[]];
    time: number;
  }
  
  /**
   * Generate realistic trade data
   */
  export class MockTradeGenerator {
    private basePrice: number;
    private volatility: number;
    private currentTime: Date;
  
    constructor(
      basePrice: number = 76000,
      volatility: number = 0.001, // 0.1% price movement
      startTime: Date = new Date()
    ) {
      this.basePrice = basePrice;
      this.volatility = volatility;
      this.currentTime = new Date(startTime);
    }
  
    /**
     * Generate a single trade
     */
    generateTrade(): MockTrade {
      // Random walk price movement
      const change = (Math.random() - 0.5) * this.basePrice * this.volatility;
      this.basePrice += change;
  
      // Random size between 0.01 and 1.0
      const size = Math.random() * 0.99 + 0.01;
  
      // Random buy/sell
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
  
      // Increment time by 1-5 seconds
      const timeIncrement = Math.floor(Math.random() * 4000) + 1000;
      this.currentTime = new Date(this.currentTime.getTime() + timeIncrement);
  
      const timeMs = this.currentTime.getTime();
  
      return {
        price: this.basePrice.toFixed(2),
        size: parseFloat(size.toFixed(5)),
        side,
  
        // keep the ISO string
        time: this.currentTime.toISOString(),
  
        // ✅ ADD: numeric ms time
        timeMs,
  
        id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      };
    }
  
    /**
     * Generate historical trades (for backfilling chart)
     */
    generateHistoricalTrades(count: number, intervalMs: number = 2000): MockTrade[] {
      const trades: MockTrade[] = [];
      const originalTime = new Date(this.currentTime);
  
      // Go back in time
      this.currentTime = new Date(originalTime.getTime() - count * intervalMs);
  
      for (let i = 0; i < count; i++) {
        trades.push(this.generateTrade());
      }
  
      // Restore current time
      this.currentTime = originalTime;
  
      return trades;
    }
  
    /**
     * Set playback speed (time multiplier)
     */
    setSpeed(multiplier: number) {
      // This will be used by the mock WebSocket to speed up time
      return multiplier;
    }
  
    /**
     * Jump forward in time
     */
    fastForward(minutes: number) {
      this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
    }
  }
  
  /**
   * Generate mock orderbook data
   */
  export function generateMockOrderBook(
    centerPrice: number,
    symbol: string = 'BTC'
  ): MockOrderBookData {
    const bids: MockOrderBookLevel[] = [];
    const asks: MockOrderBookLevel[] = [];
  
    // Generate 20 bid levels (below center price)
    for (let i = 0; i < 20; i++) {
      const priceOffset = (i + 1) * (centerPrice * 0.0001); // 0.01% increments
      const price = centerPrice - priceOffset;
      const size = (Math.random() * 5 + 0.1).toFixed(5);
  
      bids.push({
        px: price.toFixed(2),
        sz: size,
        n: Math.floor(Math.random() * 10) + 1
      });
    }
  
    // Generate 20 ask levels (above center price)
    for (let i = 0; i < 20; i++) {
      const priceOffset = (i + 1) * (centerPrice * 0.0001);
      const price = centerPrice + priceOffset;
      const size = (Math.random() * 5 + 0.1).toFixed(5);
  
      asks.push({
        px: price.toFixed(2),
        sz: size,
        n: Math.floor(Math.random() * 10) + 1
      });
    }
  
    return {
      coin: symbol,
      levels: [bids, asks],
      time: Date.now()
    };
  }
  