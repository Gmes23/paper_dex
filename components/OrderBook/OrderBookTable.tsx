import type { ProcessedLevel, Denomination } from '@/lib/types';
import { OrderBookRow } from './OrderBookRow';
import { SpreadIndicator } from './SpreadIndicator';

interface OrderBookTableProps {
    fixedAsks: (ProcessedLevel | null)[];
    fixedBids: (ProcessedLevel | null)[];
    spread: { value: number; percentage: number } | null;
    markPrice: number | null;
    maxAskTotal: number;
    maxBidTotal: number;
    denomination: Denomination;
    error: string | null;
    onPriceSelect?: (price: string) => void;
}

export function OrderBookTable({
    fixedAsks,
    fixedBids,
    spread,
    markPrice,
    maxAskTotal,
    maxBidTotal,
    denomination,
    error,
    onPriceSelect
}: OrderBookTableProps) {
    if (error) {
        return (
            <div className="p-4 text-center">
                <p className="text-red-500 text-sm">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                >
                    Reload
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Column headers */}
            <div className="grid grid-cols-3 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                <div className="text-left">Price</div>
                <div className="text-right">Size</div>
                <div className="text-right">Total</div>
            </div>

            {/* Asks - reversed so lowest ask is at bottom (closest to spread) */}
            <div className="flex flex-col">
                {[...fixedAsks].reverse().map((ask, index) => {
                    const depthValue = ask
                        ? (denomination === 'asset' ? ask.total : ask.totalUsdc)
                        : 0;
                    const depthPercentage = maxAskTotal > 0 ? (depthValue / maxAskTotal) * 100 : 0;

                    return (
                        <OrderBookRow
                            key={`ask-row-${index}`}
                            level={ask}
                            side="ask"
                            depthPercentage={depthPercentage}
                            denomination={denomination}
                            onClick={(price) => onPriceSelect?.(price)}
                        />
                    );
                })}
            </div>

            {/* Spread */}
            <SpreadIndicator spread={spread} markPrice={markPrice} />

            {/* Bids */}
            <div className="flex flex-col">
                {[...fixedBids].reverse().map((bid, index) => {
                    const depthValue = bid
                        ? (denomination === 'asset' ? bid.total : bid.totalUsdc)
                        : 0;
                    const depthPercentage = maxBidTotal > 0 ? (depthValue / maxBidTotal) * 100 : 0;

                    return (
                        <OrderBookRow
                            key={`bid-row-${index}`}
                            level={bid}
                            side="bid"
                            depthPercentage={depthPercentage}
                            denomination={denomination}
                            onClick={(price) => onPriceSelect?.(price)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
