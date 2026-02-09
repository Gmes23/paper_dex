import { useState } from 'react';
import type { PaperPosition, PaperTrade } from '@/lib/types';
import { PastTradesTable } from '@/components/PositionsTable/PastTradesTable';

interface PositionsTableProps {
    userPositions: PaperPosition[];
    pastTrades: PaperTrade[];
    getMarkPriceForSymbol: (symbol: string) => number | null;
    onClosePosition: (id: number) => void;
}

export function PositionsTable({
    userPositions,
    pastTrades,
    getMarkPriceForSymbol,
    onClosePosition
}: PositionsTableProps) {
    const [activeTab, setActiveTab] = useState('positions');

    const tabs = [
        { id: 'positions', label: 'Positions', count: userPositions.length },
        { id: 'orders', label: 'Orders', count: 0 },
        { id: 'trades', label: 'Trades' },
    ];

    const columns = ['Symbol', 'Side', 'Size', 'Leverage', 'Entry', 'Mark', 'Liq. Price', 'PNL', 'Actions'];
    const showPositions = activeTab === 'positions';
    const showTrades = activeTab === 'trades';
    const showOrders = activeTab === 'orders';

    return (
        <div className="bg-[#0d1117]">
            {/* Tab pills */}
            <div className="flex items-center gap-2 px-4 py-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1 text-xs rounded-full cursor-pointer transition ${
                            activeTab === tab.id
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="ml-1 text-gray-500">({tab.count})</span>
                        )}
                    </button>
                ))}
            </div>

            {showPositions ? (
                <>
                    <div className="grid grid-cols-9 gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                        {columns.map((col) => (
                            <div key={col}>{col}</div>
                        ))}
                    </div>

                    {userPositions.length > 0 ? (
                        <div className="flex flex-col">
                            {userPositions.map((position: PaperPosition) => {
                                const entry = Number(position.entryPrice);
                                const size = Number(position.positionSize);
                                const mark = getMarkPriceForSymbol(position.symbol);
                                const dir = position.side === 'long' ? 1 : -1;
                                const baseQty = entry > 0 ? size / entry : 0;

                                const pnl =
                                    mark != null
                                        ? ((mark - entry) / entry) * size * dir
                                        : null;

                                const pnlColor = pnl != null
                                    ? pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400'
                                    : 'text-gray-400';

                                const pnlText = pnl == null
                                    ? '—'
                                    : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`;

                                return (
                                    <div
                                        key={position.id}
                                        className="grid grid-cols-9 gap-2 px-4 py-2 text-xs border-b border-white/5 hover:bg-white/[0.02]"
                                    >
                                        <div className="text-white font-medium">{position.symbol}/USDT</div>
                                        <div className={position.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                                            {position.side === 'long' ? 'Long' : 'Short'}
                                        </div>
                                        <div className="text-gray-300 font-mono">{baseQty.toFixed(4)}</div>
                                        <div className="text-gray-300">{position.leverage}x</div>
                                        <div className="text-gray-300 font-mono">
                                            {Number.isFinite(entry) ? entry.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                        </div>
                                        <div className="text-gray-300 font-mono">
                                            {mark != null ? mark.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                        </div>
                                        <div className="text-gray-300 font-mono">
                                            {Number.isFinite(position.liquidationPrice)
                                                ? position.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                                : '—'}
                                        </div>
                                        <div className={`font-mono font-semibold ${pnlColor}`}>
                                            {pnlText}
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => onClosePosition(position.id)}
                                                className="px-2 py-0.5 text-[10px] rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                                            >
                                                CLOSE
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs text-gray-600">
                            No open positions
                        </div>
                    )}
                </>
            ) : null}

            {showTrades ? <PastTradesTable trades={pastTrades} /> : null}

            {showOrders ? (
                <div className="py-6 text-center text-xs text-gray-600">
                    No open orders
                </div>
            ) : null}
        </div>
    );
}
