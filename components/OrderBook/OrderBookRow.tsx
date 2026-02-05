import type { ProcessedLevel, Denomination } from '@/lib/types';
import { formatSize, formatTotal } from '@/lib/utils';

interface OrderBookRowProps {
    level: ProcessedLevel | null;
    side: 'bid' | 'ask';
    depthPercentage: number;
    denomination: Denomination;
    displaySide: string;
    onClick: (price: string) => void;
}

export function OrderBookRow({
    level,
    side,
    depthPercentage,
    denomination,
    displaySide,
    onClick
}: OrderBookRowProps) {
    const isBid = side === 'bid';
    const colorClass = isBid ? 'text-green-500' : 'text-red-500';
    const bgColorClass = isBid ? 'bg-green-500/10' : 'bg-red-500/10';
    const flashClass = level?.isNew
        ? (isBid ? 'animate-flash-row-green' : 'animate-flash-row-red')
        : '';


    return (
        <div
            onClick={() => level && onClick(level.priceStr)}
            className={`relative grid grid-cols-3 gap-2 px-4 py-1.5 text-sm h-8 cursor-pointer ${flashClass}`}
        >
            {level ? (
                <>
                    <div
                        className={`absolute top-[1px] bottom-[1px] 
                ${displaySide}
                ${bgColorClass} transition-[width] duration-300 ease-out`}
                        style={{ width: `${depthPercentage}%` }}
                    />

                    <div className={`${colorClass} font-mono relative z-10 text-left`}>
                        {level.priceStr}
                    </div>

                    <div className="text-gray-300 font-mono relative z-10 text-center">
                        {formatSize(level.size, level.sizeUsdc, denomination)}
                    </div>

                    <div className="text-gray-500 font-mono text-xs relative z-10 text-right">
                        {formatTotal(level.total, level.totalUsdc, denomination)}
                    </div>
                </>
            ) : (
                <>
                    <div
                        className={`absolute top-[1px] bottom-[1px] 
                ${displaySide}
                ${bgColorClass} 
                transition-[width] duration-300 ease-out`}
                        style={{ width: '0%' }}
                    />
                    <div className={`${colorClass} font-mono relative z-10`}>&nbsp;</div>
                    <div className="text-gray-300 font-mono relative z-10">&nbsp;</div>
                    <div className="text-gray-500 font-mono text-xs relative z-10">&nbsp;</div>
                </>
            )}
        </div>
    );
}