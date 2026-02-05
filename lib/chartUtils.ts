// lib/chartUtils.ts

import type { ProcessedTrade } from "./types";

export type TimeInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export type CandleData = {
    time: number;  // Unix timestamp in SECONDS
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

function getIntervalMs(interval: TimeInterval): number {
    const min = 60 * 1000;
    
    switch (interval) {
        case '1m': return min;
        case '3m': return 3 * min;
        case '5m': return 5 * min;
        case '15m': return 15 * min;
        case '30m': return 30 * min;
        case '1h': return 60 * min;
        case '2h': return 120 * min;
        case '4h': return 240 * min;
        case '8h': return 480 * min;
        case '12h': return 720 * min;
        case '1d': return 1440 * min;
        case '3d': return 4320 * min;
        case '1w': return 10080 * min;
        case '1M': return 43200 * min;
        default: return min;
    }
}

type CandleMap = Omit<CandleData, 'time'> & {
    trades: ProcessedTrade[];
};

export function aggregateTradesToCandles(
    trades: ProcessedTrade[],
    interval: TimeInterval
): CandleData[] {
    if (trades.length === 0) return [];

    const intervalMs = getIntervalMs(interval);
    const candleMap = new Map<number, CandleMap>();

    // Get today's date in UTC
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // "2026-02-05"

    console.log('🕰️ Today date string:', todayDateString);
    console.log('📊 Processing', trades.length, 'trades');

    // Sort trades by time
    const sortedTrades = [...trades].sort((a, b) => {
        const timeA = new Date(`${todayDateString}T${a.time}Z`).getTime(); // Add Z for UTC
        const timeB = new Date(`${todayDateString}T${b.time}Z`).getTime();
        return timeA - timeB;
    });

    sortedTrades.forEach((trade) => {
        const price = parseFloat(trade.price);
        
        // Parse time with UTC timezone
        const dateTimeString = `${todayDateString}T${trade.time}Z`; // Add Z for UTC
        const timestamp = new Date(dateTimeString).getTime();

        if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
            console.warn('⚠️ Skipping invalid trade:', {
                time: trade.time,
                dateTimeString,
                timestamp,
                price
            });
            return;
        }

        // Round down to the nearest interval bucket
        const bucketTime = Math.floor(timestamp / intervalMs) * intervalMs;

        const existing = candleMap.get(bucketTime);

        if (!existing) {
            candleMap.set(bucketTime, {
                trades: [trade],
                open: price,
                high: price,
                low: price,
                close: price,
                volume: trade.size
            });
        } else {
            existing.trades.push(trade);
            existing.high = Math.max(existing.high, price);
            existing.low = Math.min(existing.low, price);
            existing.close = price;
            existing.volume += trade.size;
        }
    });

    // Convert to array and format for Lightweight Charts
    const candles = Array.from(candleMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([timestampMs, candle]) => {
            // Validate candle data
            if (candle.high < Math.max(candle.open, candle.close)) {
                console.error('❌ Invalid candle: high too low', {
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    bucket: new Date(timestampMs).toISOString()
                });
                // Fix it
                candle.high = Math.max(candle.high, candle.open, candle.close);
            }
            if (candle.low > Math.min(candle.open, candle.close)) {
                console.error('❌ Invalid candle: low too high', {
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    bucket: new Date(timestampMs).toISOString()
                });
                // Fix it
                candle.low = Math.min(candle.low, candle.open, candle.close);
            }

            return {
                time: Math.floor(timestampMs / 1000), // Convert to SECONDS for Lightweight Charts
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
            };
        });

    console.log(`✅ Generated ${candles.length} candles from ${trades.length} trades`);
    
    if (candles.length > 0) {
        console.log('📍 First candle:', {
            time: new Date(candles[0].time * 1000).toISOString(),
            timeValue: candles[0].time
        });
        console.log('📍 Last candle:', {
            time: new Date(candles[candles.length - 1].time * 1000).toISOString(),
            timeValue: candles[candles.length - 1].time
        });
    }

    return candles;
}

/**
 * Format timestamp for Lightweight Charts
 * Lightweight Charts accepts: 'YYYY-MM-DD' or Unix timestamp (seconds)
 */
function formatTimeForChart(timestamp: number): number {
    // Return Unix timestamp in seconds as a NUMBER, not string
    return Math.floor(timestamp / 1000);
}