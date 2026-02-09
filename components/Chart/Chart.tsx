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
    markPrice: number | null;
}

export function PriceChart({
    candles,
    loading,
    symbol,
    interval,
    onIntervalChange,
    markPrice,
}: PriceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const [autoScale, setAutoScale] = useState(true);

    const didSetInitialDataRef = useRef(false);
    const renderedCandleTimesRef = useRef<Set<number>>(new Set());

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
                background: { type: ColorType.Solid, color: '#0d1117' },
                textColor: '#555',
            },
            grid: {
                vertLines: { color: '#161b22' },
                horzLines: { color: '#161b22' },
            },
            rightPriceScale: { borderColor: '#1b2028' },
            timeScale: {
                borderColor: '#1b2028',
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

        const sorted = [...candles]
            .map((c: any) => ({ ...c, time: Number(c.time) }))
            .filter((c) => Number.isFinite(c.time))
            .sort((a, b) => a.time - b.time);

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

        candleSeriesRef.current?.setData([] as any);
        volumeSeriesRef.current?.setData([] as any);
    }, [interval, symbol]);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        if (!candleSeries) return;
        candleSeries.priceScale().applyOptions({ autoScale });
    }, [autoScale]);

    const intervals: TimeInterval[] = ['1m', '5m', '15m', '1h'];
    const showEmpty = !loading && candles.length === 0;

    return (
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
            {/* Chart header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{symbol}/USDT</span>
                    <span className="text-lg font-bold text-white font-mono">
                        {markPrice != null
                            ? markPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                            : '—'}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {intervals.map((int) => (
                        <button
                            key={int}
                            onClick={() => onIntervalChange(int)}
                            disabled={loading}
                            className={`px-2 py-0.5 text-xs rounded cursor-pointer transition ${
                                interval === int
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-600 hover:text-gray-400'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {int}
                        </button>
                    ))}
                    <span className="w-px h-4 bg-white/10 mx-1" />
                    <button
                        onClick={() => setAutoScale((prev) => !prev)}
                        className={`px-2 py-0.5 text-xs rounded cursor-pointer transition ${
                            autoScale ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                        }`}
                        title={autoScale ? 'Auto-scale enabled' : 'Auto-scale disabled'}
                    >
                        1D
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="relative">
                <div ref={chartContainerRef} className="h-[400px]" />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-[#0d1117]/80">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mb-3" />
                            <p className="text-xs">Loading chart...</p>
                        </div>
                    </div>
                )}

                {showEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 bg-[#0d1117]/80">
                        <p className="text-xs">No chart data available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
