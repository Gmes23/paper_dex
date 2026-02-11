import { useEffect, useRef, useState } from 'react';
import type { Symbol, TradeFormState } from '@/lib/types';

interface TradeTableProps {
    symbol: Symbol;
    openMenu: string | null;
    setOpenMenu: (menu: string | null) => void;
    onTradeFormChange: (value: Partial<TradeFormState>) => void;
    onClearFormError: () => void;
    formError: string | null;
    tradeForm: TradeFormState;
    onPositionSubmit: (submission: { orderType: 'market' | 'limit'; stopLossPrice: number | null }) => void;
    currentMarkPrice: number | null;
}

export function TradeTab({
    symbol,
    onTradeFormChange,
    onClearFormError,
    formError,
    tradeForm,
    onPositionSubmit,
    currentMarkPrice
}: TradeTableProps) {
    const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Limit');
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLossInput, setStopLossInput] = useState('');
    const [localFormError, setLocalFormError] = useState<string | null>(null);
    const [sizeUnitMenuOpen, setSizeUnitMenuOpen] = useState(false);
    const isLong = tradeForm.activeTradeTab === 'Long';
    const leverageOptions = [1, 2, 5, 10];
    const sizeUnitMenuRef = useRef<HTMLDivElement | null>(null);
    const selectedSizeUnit = tradeForm.tradeAsset === 'USDC' ? 'USDC' : symbol;
    const sizeNumeric = Number(tradeForm.size);
    const parsedInputPrice = Number(tradeForm.inputPrice);
    const referencePrice =
        orderType === 'Market'
            ? (currentMarkPrice ?? (Number.isFinite(parsedInputPrice) ? parsedInputPrice : 0))
            : (Number.isFinite(parsedInputPrice) && parsedInputPrice > 0
                ? parsedInputPrice
                : (currentMarkPrice ?? 0));
    const hasReferencePrice = Number.isFinite(referencePrice) && referencePrice > 0;
    const leverage = Number(tradeForm.leverage);
    const hasSize = Number.isFinite(sizeNumeric) && sizeNumeric > 0;

    const estimatedUsdcValue =
        selectedSizeUnit === 'USDC'
            ? sizeNumeric
            : (Number.isFinite(sizeNumeric) && hasReferencePrice ? sizeNumeric * referencePrice : null);
    const estimatedCoinValue =
        selectedSizeUnit === 'USDC'
            ? (Number.isFinite(sizeNumeric) && hasReferencePrice ? sizeNumeric / referencePrice : null)
            : sizeNumeric;
    const positionNotionalUsdc =
        Number.isFinite(Number(estimatedUsdcValue)) && (estimatedUsdcValue as number) > 0
            ? (estimatedUsdcValue as number)
            : null;
    const marginRequiredUsdc =
        positionNotionalUsdc && Number.isFinite(leverage) && leverage > 0
            ? positionNotionalUsdc / leverage
            : null;
    const estimatedLiquidationPrice =
        hasReferencePrice && Number.isFinite(leverage) && leverage > 0
            ? (isLong
                ? referencePrice * (1 - 1 / leverage)
                : referencePrice * (1 + 1 / leverage))
            : null;
    const feeRatePerSide = orderType === 'Market' ? 0.00045 : 0.0002;
    const estimatedFeesUsdc =
        positionNotionalUsdc
            ? positionNotionalUsdc * feeRatePerSide * 2
            : null;
    const maxLossUsdc = marginRequiredUsdc;
    const parsedStopLoss = Number(stopLossInput);
    const stopLossPrice =
        stopLossEnabled && Number.isFinite(parsedStopLoss) && parsedStopLoss > 0
            ? parsedStopLoss
            : null;
    const isMarketOrder = orderType === 'Market';
    const displayFormError = localFormError ?? formError;
    const displayedPriceValue = isMarketOrder
        ? (currentMarkPrice != null ? currentMarkPrice.toFixed(1) : '')
        : tradeForm.inputPrice;
    const clearFormErrors = () => {
        setLocalFormError(null);
        onClearFormError();
    };
    const applyTradeFormChange = (value: Partial<TradeFormState>) => {
        clearFormErrors();
        onTradeFormChange(value);
    };

    const handleSubmit = () => {
        clearFormErrors();
        if (isMarketOrder && (!Number.isFinite(Number(currentMarkPrice)) || Number(currentMarkPrice) <= 0)) {
            setLocalFormError('Market price unavailable. Please wait for live price.');
            return;
        }
        if (stopLossEnabled && stopLossPrice == null) {
            setLocalFormError('Please enter a valid stop loss price.');
            return;
        }
        onPositionSubmit({
            orderType: isMarketOrder ? 'market' : 'limit',
            stopLossPrice,
        });
    };

    const formatDecimal = (value: number, decimals: number) => {
        if (!Number.isFinite(value)) return '';
        return value
            .toFixed(decimals)
            .replace(/\.?0+$/, '');
    };
    const formatUsdc = (value: number | null) =>
        value != null && Number.isFinite(value)
            ? `${Number(value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })} USDC`
            : '—';
    const formatPrice = (value: number | null) =>
        value != null && Number.isFinite(value)
            ? Number(value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
            : '—';

    const switchSizeUnit = (nextUnit: Symbol | 'USDC') => {
        if (tradeForm.tradeAsset === nextUnit) return;

        const currentValue = Number(tradeForm.size);
        if (!Number.isFinite(currentValue) || currentValue <= 0 || !hasReferencePrice) {
            applyTradeFormChange({ tradeAsset: nextUnit });
            return;
        }

        if (nextUnit === 'USDC') {
            applyTradeFormChange({
                tradeAsset: 'USDC',
                size: formatDecimal(currentValue * referencePrice, 2),
            });
            return;
        }

        applyTradeFormChange({
            tradeAsset: nextUnit,
            size: formatDecimal(currentValue / referencePrice, 6),
        });
    };

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!sizeUnitMenuRef.current?.contains(target)) {
                setSizeUnitMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Place Order</div>

            {/* Limit / Market toggle */}
            <div className="grid grid-cols-2 gap-1 mb-3">
                <button
                    onClick={() => {
                        clearFormErrors();
                        setOrderType('Limit');
                    }}
                    className={`py-1.5 text-xs rounded cursor-pointer transition ${
                        orderType === 'Limit'
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    Limit
                </button>
                <button
                    onClick={() => {
                        clearFormErrors();
                        setOrderType('Market');
                    }}
                    className={`py-1.5 text-xs rounded cursor-pointer transition ${
                        orderType === 'Market'
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    Market
                </button>
            </div>

            {/* Long / Short toggle */}
            <div className="grid grid-cols-2 gap-1 mb-4">
                <button
                    className={`py-2 text-xs font-semibold rounded cursor-pointer transition ${
                        isLong
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/5 text-gray-400 hover:text-gray-200'
                    }`}
                    onClick={() => applyTradeFormChange({ activeTradeTab: 'Long' })}
                >
                    Long
                </button>
                <button
                    className={`py-2 text-xs font-semibold rounded cursor-pointer transition ${
                        !isLong
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-gray-200'
                    }`}
                    onClick={() => applyTradeFormChange({ activeTradeTab: 'Short' })}
                >
                    Short
                </button>
            </div>

            {/* Price */}
            <div className="mb-2">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Price</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded px-3 py-2">
                    <input
                        type="text"
                        readOnly={isMarketOrder}
                        className={`min-w-0 flex-1 bg-transparent text-sm font-mono outline-none ${
                            isMarketOrder ? 'text-cyan-300 cursor-not-allowed' : 'text-white'
                        }`}
                        value={displayedPriceValue}
                        onChange={(e) => {
                            if (isMarketOrder) return;
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            applyTradeFormChange({ inputPrice: value });
                        }}
                        placeholder={isMarketOrder ? 'Waiting for live market...' : '0.0'}
                    />
                    <span className="text-xs text-gray-500 ml-2">USDC</span>
                </div>
                {isMarketOrder ? (
                    <div className="mt-1 text-[11px] text-cyan-300/80">
                        Market price locked
                    </div>
                ) : null}
            </div>

            {/* Stop Loss */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-gray-500">Stop Loss</label>
                    <button
                        type="button"
                        onClick={() => {
                            clearFormErrors();
                            setStopLossEnabled((prev) => !prev);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                            stopLossEnabled
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-white/5 text-gray-500 border border-white/10 hover:text-gray-300'
                        }`}
                    >
                        {stopLossEnabled ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded px-3 py-2">
                    <input
                        type="text"
                        disabled={!stopLossEnabled}
                        className="min-w-0 flex-1 bg-transparent text-sm font-mono text-white outline-none disabled:text-gray-600"
                        value={stopLossInput}
                        onChange={(e) => {
                            clearFormErrors();
                            setStopLossInput(e.target.value.replace(/[^0-9.]/g, ''));
                        }}
                        placeholder={stopLossEnabled ? '0.0' : 'Enable to set stop loss'}
                    />
                    <span className="text-xs text-gray-500 ml-2">USDC</span>
                </div>
            </div>

            {/* Size */}
            <div className="mb-2">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Size</label>
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded px-3 py-2">
                    <input
                        type="text"
                        className="min-w-0 w-full bg-transparent pr-20 text-sm font-mono text-white outline-none"
                        value={tradeForm.size}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            applyTradeFormChange({ size: val });
                        }}
                        placeholder="0.0000"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2" ref={sizeUnitMenuRef}>
                        <button
                            type="button"
                            onClick={() => {
                                clearFormErrors();
                                setSizeUnitMenuOpen((prev) => !prev);
                            }}
                            className="h-6 min-w-[64px] rounded border border-white/10 bg-[#161d29] px-2 pr-4 text-[11px] font-medium text-gray-200 outline-none transition hover:text-white text-left cursor-pointer"
                        >
                            {selectedSizeUnit}
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                                v
                            </span>
                        </button>
                        {sizeUnitMenuOpen ? (
                            <div className="absolute right-0 mt-1 w-[74px] overflow-hidden rounded-md border border-white/10 bg-[#111823] shadow-lg shadow-black/40 z-20">
                                <button
                                    type="button"
                                    onClick={() => {
                                        switchSizeUnit(symbol);
                                        setSizeUnitMenuOpen(false);
                                    }}
                                    className={`w-full px-2 py-1.5 text-left text-[11px] transition cursor-pointer ${
                                        selectedSizeUnit === symbol
                                            ? 'text-white bg-white/10'
                                            : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                >
                                    {symbol}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        switchSizeUnit('USDC');
                                        setSizeUnitMenuOpen(false);
                                    }}
                                    className={`w-full px-2 py-1.5 text-left text-[11px] transition cursor-pointer ${
                                        selectedSizeUnit === 'USDC'
                                            ? 'text-white bg-white/10'
                                            : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                >
                                    USDC
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                    {selectedSizeUnit === symbol ? (
                        Number.isFinite(Number(estimatedUsdcValue)) && (estimatedUsdcValue as number) > 0
                            ? `Worth: ${formatDecimal(estimatedUsdcValue as number, 2)} USDC`
                            : 'Worth: — USDC'
                    ) : (
                        Number.isFinite(Number(estimatedCoinValue)) && (estimatedCoinValue as number) > 0
                            ? `Est. Qty: ${formatDecimal(estimatedCoinValue as number, 6)} ${symbol}`
                            : `Est. Qty: — ${symbol}`
                    )}
                </div>
            </div>

            {/* Leverage */}
            <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Leverage</label>
                <div className="grid grid-cols-6 gap-1">
                    {leverageOptions.map((lev) => (
                        <button
                            key={lev}
                            onClick={() => applyTradeFormChange({ leverage: lev })}
                            className={`py-1.5 text-xs rounded cursor-pointer transition ${
                                tradeForm.leverage === lev
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white/5 text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {lev}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Info rows */}
            <div className="flex flex-col gap-1.5 mb-4 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-500">Entry Price (est.)</span>
                    <span className="text-gray-300">
                        {hasSize ? `${formatPrice(referencePrice)} USDC` : '—'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Position Notional</span>
                    <span className="text-gray-300">{formatUsdc(positionNotionalUsdc)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Margin Required</span>
                    <span className="text-gray-300">{formatUsdc(marginRequiredUsdc)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Est. Liquidation</span>
                    <span className="text-gray-300">
                        {hasSize ? `${formatPrice(estimatedLiquidationPrice)} USDC` : '—'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Fees (est.)</span>
                    <span className="text-gray-300">{formatUsdc(estimatedFeesUsdc)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Max Loss (est.)</span>
                    <span className="text-gray-300">{formatUsdc(maxLossUsdc)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Stop Loss</span>
                    <span className="text-amber-300">
                        {stopLossPrice != null ? `${formatPrice(stopLossPrice)} USDC` : '—'}
                    </span>
                </div>
            </div>

            {displayFormError ? (
                <div className="mb-3 flex justify-end">
                    <div className="relative group">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-400/60 bg-rose-500/20 text-[10px] font-bold text-rose-300">
                            !
                        </span>
                        <div className="pointer-events-none absolute right-0 top-5 z-30 w-56 rounded border border-rose-400/40 bg-[#241018] px-2 py-1 text-[11px] text-rose-200 opacity-0 transition group-hover:opacity-100">
                            {displayFormError}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                className={`w-full py-3 rounded text-sm font-semibold cursor-pointer transition ${
                    isLong
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
            >
                {orderType === 'Market' ? 'Open' : 'Place'} {isLong ? 'Long' : 'Short'} {orderType}
            </button>
        </div>
    );
}
