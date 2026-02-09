import type { ProcessedLevel, Denomination } from '@/lib/types';
import { formatSize, formatTotal } from '@/lib/utils';

interface OrderBookRowProps {
    level: ProcessedLevel | null;
    side: 'bid' | 'ask';
    depthPercentage: number;
    denomination: Denomination;
    onClick: (price: string) => void;
}

export function OrderBookRow({
    level,
    side,
    depthPercentage,
    denomination,
    onClick
}: OrderBookRowProps) {
    const isBid = side === 'bid';
    const colorClass = isBid ? 'text-green-400' : 'text-red-400';
    const bgColorClass = isBid ? 'bg-green-500/8' : 'bg-red-500/8';
    const flashClass = level?.isNew
        ? (isBid ? 'animate-flash-row-green' : 'animate-flash-row-red')
        : '';

    return (
        <div
            onClick={() => level && onClick(level.priceStr)}
            className={`relative grid grid-cols-3 px-3 py-[3px] text-xs cursor-pointer hover:bg-white/5 ${flashClass}`}
        >
            {level ? (
                <>
                    <div
                        className={`absolute top-0 bottom-0 right-0 ${bgColorClass} transition-[width] duration-300 ease-out`}
                        style={{ width: `${depthPercentage}%` }}
                    />

                    <div className={`${colorClass} font-mono relative z-10 text-left`}>
                        {level.priceStr}
                    </div>

                    <div className="text-gray-300 font-mono relative z-10 text-right">
                        {formatSize(level.size, level.sizeUsdc, denomination)}
                    </div>

                    <div className="text-gray-500 font-mono relative z-10 text-right">
                        {formatTotal(level.total, level.totalUsdc, denomination)}
                    </div>
                </>
            ) : (
                <>
                    <div className="relative z-10">&nbsp;</div>
                    <div className="relative z-10">&nbsp;</div>
                    <div className="relative z-10">&nbsp;</div>
                </>
            )}
        </div>
    );
}
