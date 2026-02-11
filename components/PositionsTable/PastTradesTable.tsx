import type { PaperTrade } from '@/lib/types';

interface PastTradesTableProps {
    trades: PaperTrade[];
}

const columns = ['Date', 'Symbol', 'Side', 'Size', 'Entry', 'Exit', 'PNL', 'Status'];

function formatDate(dateValue: string) {
    const date = new Date(dateValue);
    if (!Number.isFinite(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPrice(value: number) {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function PastTradesTable({ trades }: PastTradesTableProps) {
    if (trades.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-6 text-center text-xs text-gray-600">
                No past trades
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="grid grid-cols-8 gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                {columns.map((col) => (
                    <div key={col}>{col}</div>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col">
                    {trades.map((trade) => {
                        const entry = Number(trade.entryPrice);
                        const size = Number(trade.positionSize);
                        const baseQty = entry > 0 ? size / entry : 0;
                        const pnl = Number(trade.realizedPnl);
                        const pnlColor =
                            pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400';

                        return (
                            <div
                                key={trade.id}
                                className="grid grid-cols-8 gap-2 px-4 py-2 text-xs border-b border-white/5 hover:bg-white/[0.02]"
                            >
                                <div className="text-gray-300">{formatDate(trade.closedAt)}</div>
                                <div className="text-white font-medium">{trade.symbol}/USDT</div>
                                <div className={trade.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                                    {trade.side === 'long' ? 'Long' : 'Short'}
                                </div>
                                <div className="text-gray-300 font-mono">{baseQty.toFixed(4)}</div>
                                <div className="text-gray-300 font-mono">{formatPrice(entry)}</div>
                                <div className="text-gray-300 font-mono">{formatPrice(trade.exitPrice)}</div>
                                <div className={`font-mono font-semibold ${pnlColor}`}>
                                    {`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}
                                </div>
                                <div className="text-gray-400 uppercase">{trade.status}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
