import type { ProcessedTrade, Denomination, Symbol } from '@/lib/types';
import { formatSize, getDenomLabel } from '@/lib/utils';

interface TradesTableProps {
  trades: ProcessedTrade[];
  denomination: Denomination;
  symbol: Symbol;
}

export function TradesTable({ trades, denomination, symbol }: TradesTableProps) {
  const denomLabel = getDenomLabel(denomination, symbol);

  const getTradeHeight = (trade: ProcessedTrade): string => {
    const size = denomination === 'asset' ? trade.size : trade.sizeUsdc;

    if (size >= 10000) return 'h-50';     
    if (size >= 5000) return 'h-20';      
    if (size >= 3000) return 'h-16';      
    if (size >= 1000) return 'h-12';      
    if (size >= 50) return 'h-10';       
    return 'h-8';    
  }


  return (
    <div className="bg-[#131722] rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
        <div className="text-left">Price</div>
        <div className="text-center">Size ({denomLabel})</div>
        <div className="text-right">Time</div>
      </div>

      {/* Trades List */}
      <div className={`
      h-[32.875rem]
      overflow-y-auto
      `}>
        {trades.map((trade) => (

            <div key={trade.id} className={`${trade.side === 'buy' ? 'bg-green-400' : 'bg-rose-400' } text-black`}>
          <div
            key={trade.id}
            className={`grid grid-cols-3 gap-2 px-4 py-1.5 text-sm hover:bg-[#1e222d] transition-colors
            border
            ${getTradeHeight(trade)}
            `}
          >
            <div
              className={`font-mono text-left 
                text-black
              `}
            >
              {trade.price}
            </div>

            <div className="text-center text-black-300 font-mono">
              {formatSize(trade.size, trade.sizeUsdc, denomination)}
            </div>

            <div className="text-right text-black-500 text-md">
              {trade.time}
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}