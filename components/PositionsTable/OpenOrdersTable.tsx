import type { PaperOrder } from '@/lib/types';

interface OpenOrdersTableProps {
    orders: PaperOrder[];
    onCancelOrder: (orderId: number) => void;
}

const columns = ['Date', 'Type', 'Symbol', 'Side', 'Size', 'Price', 'Stop', 'Actions'];

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

function formatPrice(value: number | null) {
    if (value == null || !Number.isFinite(value)) return '—';
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function OpenOrdersTable({ orders, onCancelOrder }: OpenOrdersTableProps) {
    if (orders.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-6 text-center text-xs text-gray-600">
                No open orders
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
                    {orders.map((order) => {
                        return (
                            <div
                                key={order.id}
                                className="grid grid-cols-8 gap-2 px-4 py-2 text-xs border-b border-white/5 hover:bg-white/[0.02]"
                            >
                                <div className="text-gray-300">{formatDate(order.createdAt)}</div>
                                <div className="text-gray-300 uppercase">{order.orderType.replace('_', ' ')}</div>
                                <div className="text-white font-medium">{order.symbol}/USDT</div>
                                <div className={order.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                                    {order.side === 'long' ? 'Long' : 'Short'}
                                </div>
                                <div className="text-gray-300 font-mono">
                                    {order.positionSize.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </div>
                                <div className="text-gray-300 font-mono">{formatPrice(order.limitPrice)}</div>
                                <div className="text-amber-400 font-mono">{formatPrice(order.stopPrice)}</div>
                                <div>
                                    <button
                                        onClick={() => onCancelOrder(order.id)}
                                        className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-gray-300 hover:bg-white/20 cursor-pointer"
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
