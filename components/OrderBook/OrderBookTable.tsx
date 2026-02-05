import type { ProcessedLevel, Denomination, Symbol } from '@/lib/types';
import { OrderBookRow } from './OrderBookRow';
import { SpreadIndicator } from './SpreadIndicator';
import { getDenomLabel } from '@/lib/utils';

interface OrderBookTableProps {
    fixedAsks: (ProcessedLevel | null)[];
    fixedBids: (ProcessedLevel | null)[];
    spread: { value: number; percentage: number } | null;
    maxAskTotal: number;
    maxBidTotal: number;
    denomination: Denomination;
    symbol: Symbol;
    error: string | null;
    onPriceSelect?: (price: string) => void;
}

export function OrderBookTable({
    fixedAsks,
    fixedBids,
    spread,
    maxAskTotal,
    maxBidTotal,
    denomination,
    symbol,
    error,
    onPriceSelect
}: OrderBookTableProps) {
    const denomLabel = getDenomLabel(denomination, symbol);

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0e13] text-white p-4">
                <div className="max-w-md mx-auto">
                    <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-center">
                        <p className="text-red-500 font-semibold">⚠️ Error</p>
                        <p className="text-gray-300 text-sm mt-2">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-500 rounded hover:bg-red-600"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[#131722] rounded-lg overflow-hidden">
            {/* Headers */}
            <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
                <div className="text-left">Price</div>
                <div className="text-center">Size ({denomLabel})</div>
                <div className="text-right">Total ({denomLabel})</div>

                <div className="text-left">Price</div>
                <div className="text-center">Size ({denomLabel})</div>
                <div className="text-right">Total ({denomLabel})</div>
            </div>

            {/* Asks */}


            <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                    {fixedAsks.map((ask, index) => {
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
                                displaySide="left-0"
                                onClick={(price) => onPriceSelect?.(price)}
                            />
                        );
                    })}
                </div>


                {/* Bids */}
                <div className="relative">
                    {fixedBids.map((bid, index) => {
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
                                displaySide='right-0'
                                onClick={(price) => onPriceSelect?.(price)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Spread */}
            <SpreadIndicator spread={spread} />
        </div>
    );
}