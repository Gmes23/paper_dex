'use client';

import { useEffect, useRef, useState } from 'react';
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    CandlestickSeries,
    HistogramSeries,
} from 'lightweight-charts';
import type { TimeInterval, CandleData } from '@/lib/chartUtils';

interface PriceChartProps {
    candles: CandleData[];
    loading: boolean;
    symbol: string;
    interval: TimeInterval;
    onIntervalChange: (interval: TimeInterval) => void;
}

export function PriceChart({
    candles,
    loading,
    symbol,
    interval,
    onIntervalChange,
}: PriceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const [autoScale, setAutoScale] = useState(true);

    // Track if we already set full history once
    const didSetInitialDataRef = useRef(false);

    // Track the last N candle times we've rendered (to detect updates vs new candles)
    const renderedCandleTimesRef = useRef<Set<number>>(new Set());

    // Reset when interval or symbol changes
    useEffect(() => {
        didSetInitialDataRef.current = false;
        renderedCandleTimesRef.current = new Set();
    }, [interval, symbol]);

    // Create chart ONCE
    useEffect(() => {
        if (!chartContainerRef.current) return;
        if (chartRef.current) return;

        const container = chartContainerRef.current;

        const chart = createChart(container, {
            width: container.clientWidth,
            height: 400,
            layout: {
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1a1e27' },
                horzLines: { color: '#1a1e27' },
            },
            rightPriceScale: { borderColor: '#2B2B43' },
            timeScale: {
                borderColor: '#2B2B43',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        const handleResize = () => {
            if (!chartRef.current || !chartContainerRef.current) return;
            chartRef.current.applyOptions({
                width: chartContainerRef.current.clientWidth,
            });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        const volumeSeries = volumeSeriesRef.current;

        if (!candleSeries || !volumeSeries) return;
        if (loading) return;
        if (!candles || candles.length === 0) return;

        // Defensive: ensure sorted ascending and numeric time
        const sorted = [...candles]
            .map((c: any) => ({ ...c, time: Number(c.time) }))
            .filter((c) => Number.isFinite(c.time))
            .sort((a, b) => a.time - b.time);

        // If we haven't set initial history yet, set it once
        if (!didSetInitialDataRef.current) {
            candleSeries.setData(sorted as any);

            volumeSeries.setData(
                sorted.map((c) => ({
                    time: c.time as any,
                    value: c.volume,
                    color: c.close >= c.open ? '#26a69a80' : '#ef535080',
                })) as any
            );

            chartRef.current?.timeScale().fitContent();
            didSetInitialDataRef.current = true;
            return;
        }

        // Real-time incremental update: ONLY update the latest candle
        const last = sorted[sorted.length - 1];

        candleSeries.update(last as any);
        volumeSeries.update({
            time: last.time as any,
            value: last.volume,
            color: last.close >= last.open ? '#26a69a80' : '#ef535080',
        } as any);
    }, [candles, loading]);

    useEffect(() => {
        didSetInitialDataRef.current = false;
        renderedCandleTimesRef.current = new Set();

        // IMPORTANT: clear the series so old timeframe bars don't conflict
        candleSeriesRef.current?.setData([] as any);
        volumeSeriesRef.current?.setData([] as any);
    }, [interval, symbol]);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        if (!candleSeries) return;
        candleSeries.priceScale().applyOptions({ autoScale });
    }, [autoScale]);



    const showEmpty = !loading && candles.length === 0;

    return (
        <div className="bg-[#131722] p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">{symbol}/USDC</h2>

                <div className="flex gap-2 items-center">
                    {(['1m', '5m', '15m', '1h'] as TimeInterval[]).map((int) => (
                        <button
                            key={int}
                            onClick={() => onIntervalChange(int)}
                            disabled={loading}
                            className={`px-3 py-1 rounded transition ${interval === int
                                ? 'bg-teal-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {int}
                        </button>
                    ))}
                    <button
                        onClick={() => setAutoScale((prev) => !prev)}
                        className={`px-3 py-1 rounded font-bold transition ${
                            autoScale ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        title={autoScale ? 'Auto-scale enabled' : 'Auto-scale disabled'}
                        aria-pressed={autoScale}
                    >
                        A
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-500 mb-2">
                Displaying {candles.length} candles
            </p>

            <div className="relative rounded overflow-hidden">
                <div ref={chartContainerRef} className="h-[400px]" />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-[#131722]/80">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
                            <p>Loading chart data...</p>
                        </div>
                    </div>
                )}

                {showEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-[#131722]/80">
                        <p>No chart data available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
