import type { ProcessedTrade, Denomination, Symbol } from '@/lib/types';
import { formatSize, getDenomLabel } from '@/lib/utils';

interface TradesTableProps {
  trades: ProcessedTrade[];
  denomination: Denomination;
  symbol: Symbol;
  onToggleDenomination: () => void;
}

export function TradesTable({ trades, denomination, symbol, onToggleDenomination }: TradesTableProps) {
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
    <div className="flex flex-col h-full">
      {/* Headers */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
        <div className="text-left">Price</div>
        <button
          type="button"
          onClick={onToggleDenomination}
          className="text-right text-gray-400 hover:text-white transition cursor-pointer"
          title="Toggle size denomination"
        >
          ({denomLabel}) Size
        </button>
        <div className="text-right">Time</div>
      </div>

      {/* Trades List */}
      <div className="h-full overflow-y-auto">
        {trades.map((trade) => (

            <div key={trade.id} className={`${trade.side === 'buy' ? 'bg-green-500' : 'bg-red-300' } text-black`}>
          <div
            key={trade.id}
            className={`grid grid-cols-3 gap-2 px-4 py-1.5 text-sm hover:bg-[#1e222d] transition-colors
            border
            ${getTradeHeight(trade)}
            `}
          >
            <div
              className={`font-mono text-left 
                text-xs text-black
              `}
            >
              {trade.price}
            </div>

            <div className="text-right text-black-300 font-mono text-xs">
              {formatSize(trade.size, trade.sizeUsdc, denomination)}
            </div>

            <div className="text-right text-black-500 text-xs">
              {trade.time}
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
