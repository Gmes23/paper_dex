// workers/orderbook.worker.ts
import { aggregateLevels } from '../lib/orderbook';
import { NUM_ROWS } from '../lib/constants';

// ✅ Maintain flash animation state INSIDE the worker
let knownBidPrices = new Set<number>();
let knownAskPrices = new Set<number>();
let skipFlash = true;
let currentSymbol: string | null = null;
let currentGrouping: number | null = null;

self.onmessage = (event) => {
  const { rawBids, rawAsks, priceGrouping, symbol } = event.data;

  // ✅ Reset known prices if symbol or grouping changed
  if (symbol !== currentSymbol || priceGrouping !== currentGrouping) {
    knownBidPrices = new Set();
    knownAskPrices = new Set();
    skipFlash = true;
    currentSymbol = symbol;
    currentGrouping = priceGrouping;
  }

  // ✅ Aggregate with flash detection
  const bidsResult = aggregateLevels(
    rawBids,
    priceGrouping,
    true,
    knownBidPrices,  // ← Persistent state in worker
    skipFlash
  );
  
  const asksResult = aggregateLevels(
    rawAsks,
    priceGrouping,
    false,
    knownAskPrices,  // ← Persistent state in worker
    skipFlash
  );

  // ✅ Update known prices for next time
  knownBidPrices = bidsResult.newKnownPrices;
  knownAskPrices = asksResult.newKnownPrices;

  if(knownAskPrices.size > 1000 && knownBidPrices.size > 1000) {
    const currentOrderBookPrices = new Set([...rawBids, ...rawAsks].map(object => parseFloat(object.px)));

    knownAskPrices = new Set([...knownAskPrices].filter(p => currentOrderBookPrices.has(p)))

    knownBidPrices = new Set([...knownBidPrices].filter((bidprice) => currentOrderBookPrices.has(bidprice)))
  }

  skipFlash = false;

  // ✅ Process results
  const aggregatedBids = bidsResult.levels.slice(0, NUM_ROWS);
  const aggregatedAsks = asksResult.levels.slice(0, NUM_ROWS);
  const displayAsks = [...aggregatedAsks].reverse();

  // ✅ Calculate spread
  let spread = null;
  let bestBid = null;
  let bestAsk = null;
  if (aggregatedBids.length > 0 && aggregatedAsks.length > 0) {
    bestBid = aggregatedBids[0].price;
    bestAsk = aggregatedAsks[0].price;
    const spreadValue = bestAsk - bestBid;
    const spreadPercentage = (spreadValue / bestAsk) * 100;
    spread = { value: spreadValue, percentage: spreadPercentage };
  }

  // ✅ Calculate max totals
  const maxBidTotalAsset = aggregatedBids.length > 0 
    ? Math.max(...aggregatedBids.map(b => b.total)) 
    : 0;
  const maxBidTotalUsdc = aggregatedBids.length > 0 
    ? Math.max(...aggregatedBids.map(b => b.totalUsdc)) 
    : 0;

  const maxAskTotalAsset = displayAsks.length > 0 
    ? Math.max(...displayAsks.map(a => a.total)) 
    : 0;
  const maxAskTotalUsdc = displayAsks.length > 0 
    ? Math.max(...displayAsks.map(a => a.totalUsdc)) 
    : 0;

  // ✅ Send complete results back
  self.postMessage({
    bids: aggregatedBids,
    asks: displayAsks,
    bestBid,
    bestAsk, 
    spread,
    maxBidTotal: { 
      asset: maxBidTotalAsset, 
      usdc: maxBidTotalUsdc 
    },
    maxAskTotal: { 
      asset: maxAskTotalAsset, 
      usdc: maxAskTotalUsdc 
    },
    symbol  // Echo back for verification
  });
};

export {};