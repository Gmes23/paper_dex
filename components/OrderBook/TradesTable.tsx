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

    if (size >= 10000) return 'h-[50px]';
    if (size >= 5000) return 'h-[40px]';
    if (size >= 3000) return 'h-[34px]';
    if (size >= 1000) return 'h-[30px]';
    if (size >= 50) return 'h-[26px]';
    return 'h-[22px]';
  };


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
        {trades.map((trade) => {
          const rowTheme =
            trade.side === 'buy'
              ? 'bg-emerald-500/18 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/24'
              : 'bg-rose-500/18 border-rose-400/30 text-rose-100 hover:bg-rose-500/24';

          return (
            <div key={trade.id} className="px-2 py-0.5">
              <div
                className={`grid grid-cols-3 gap-2 items-center px-3 transition-colors cursor-pointer ${getTradeHeight(trade)} ${rowTheme}`}
              >
                <div className="font-mono text-left text-xs">
                  {trade.price}
                </div>

                <div className="text-right font-mono text-xs">
                  {formatSize(trade.size, trade.sizeUsdc, denomination)}
                </div>

                <div className="text-right text-xs text-white/80">
                  {trade.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
