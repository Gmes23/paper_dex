// workers/orderbook.worker.ts
import { aggregateLevels } from '../lib/orderbook';
import { NUM_ROWS } from '../lib/constants';

// ✅ Maintain flash animation state INSIDE the worker
let knownBidPrices = new Set<number>();
let knownAskPrices = new Set<number>();
let skipFlash = true;
let currentSymbol: string | null = null;
let currentGrouping: number | null = null;
const MAX_KNOWN_PRICES = 1000;

function buildCurrentPriceSet(rawBids: Array<{ px: string }>, rawAsks: Array<{ px: string }>) {
  const prices = new Set<number>();

  for (const bid of rawBids) {
    const price = Number.parseFloat(bid.px);
    if (Number.isFinite(price)) prices.add(price);
  }
  for (const ask of rawAsks) {
    const price = Number.parseFloat(ask.px);
    if (Number.isFinite(price)) prices.add(price);
  }

  return prices;
}

function pruneKnownPrices(knownPrices: Set<number>, currentPrices: Set<number>) {
  for (const price of knownPrices) {
    if (!currentPrices.has(price)) {
      knownPrices.delete(price);
    }
  }
}

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

  if (knownAskPrices.size > MAX_KNOWN_PRICES || knownBidPrices.size > MAX_KNOWN_PRICES) {
    const currentOrderBookPrices = buildCurrentPriceSet(rawBids, rawAsks);
    pruneKnownPrices(knownAskPrices, currentOrderBookPrices);
    pruneKnownPrices(knownBidPrices, currentOrderBookPrices);
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
    symbol,  // Echo back for verification
    timestamp: Date.now(),
  });
};

export {};
