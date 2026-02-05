import { useState } from 'react';
import type { Position } from '@/lib/types';

interface PositionsTableProps {
    userPositions: Position[];
    markPrice: number | null;
    positionsPNL: (number | string)[] | null;
}


export function PositionsTable({
    userPositions,
    markPrice,
    positionsPNL
}: PositionsTableProps) {

    const positionsTabs = [
        {
            key: 'Balances' + 1,
            name: 'Balances'
        },
        {
            key: 'Positions' + 1, name:
                'Positions'
        }, {
            key: 'Open Orders' + 1,
            name: 'Open Orders'
        }, {
            key: 'Trade History' + 1,
            name: 'Trade History'
        }, {
            key: 'Order History',
            name: 'Order History'
        }
    ]

    const currentTab = [
        { key: 'Positions' + 2, label: 'Coin' },
        {
            key: 'Positions' + 3, label: 'Size'
        }, {
            key: 'Positions' + 4,
            label: 'Position Value'
        }, {
            key: 'Entry Price',
            label: 'Entry Price'
        }, {
            key: 'Mark Price',
            label: 'Mark Price'
        }, {
            key: 'PNL',
            label: 'PNL (ROE%)'
        }, {
            key: 'lid price',
            label: 'liq price'
        }
    ];



    return (
        <div className="flex flex-col min-w-full p-3 bg-tan-500 text-white">
            <div className="flex gap-4">
                {positionsTabs.map(item => (

                    <div key={item.key}
                        className="cursor-pointer
                    hover:text-teal-400
                    hover:underline
                    hover:decoration-teal-400">
                        {item.name}
                    </div>))}
            </div>


            <div className="flex gap-9">
                {currentTab.map(item => (
                    <div
                        key={item.key}
                    >
                        {item.label}
                    </div>
                ))}
            </div>

            {/* Positions */}
            {userPositions && userPositions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3">
                    {userPositions.map((position: Position) => {
                        const entry = Number(position.inputPrice);
                        const size = Number(position.size);

                        // guard against empty inputs / NaN
                        const hasNumbers = Number.isFinite(entry) && Number.isFinite(size);

                        const mark = markPrice; // number | null

                        const dir = position.activeTradeTab === "Long" ? 1 : -1;

                        const pnlSigned =
                            mark != null && hasNumbers
                                ? (mark - entry) * size * dir
                                : null;

                        const pnlIsProfit = pnlSigned != null && pnlSigned > 0;
                        const pnlIsLoss = pnlSigned != null && pnlSigned < 0;

                        const pnlText =
                            pnlSigned == null
                                ? "—"
                                : `${pnlSigned >= 0 ? "+" : "-"}${Math.abs(pnlSigned).toFixed(2)}`;

                        return (
                            <div
                                key={position.id}
                                className="flex gap-9 bg-slate-800 min-h-13 items-center p-2 rounded"
                            >
                                {/* Side */}
                                <div
                                    className={`
          ${position.activeTradeTab === "Long" ? "bg-green-400" : "bg-red-400"}
          min-w-[4.75rem] min-h-full flex justify-center items-center
          text-gray-900 font-bold rounded
        `}
                                >
                                    {position.activeTradeTab}
                                </div>

                                {/* Coin */}
                                <div className="min-w-[4.75rem]">{position.tradeAsset}</div>

                                {/* Size */}
                                <div className="min-w-[4.75rem]">{position.size}</div>

                                {/* Entry Price */}
                                <div className="min-w-[4.75rem]">
                                    {Number.isFinite(entry) ? `$${entry.toFixed(2)}` : "—"}
                                </div>

                                {/* Mark Price */}
                                <div className="min-w-[4.75rem]">
                                    {mark != null ? `$${mark.toFixed(2)}` : "—"}
                                </div>

                                {/* PNL */}
                                <div
                                    className={`min-w-[4.75rem] font-mono ${pnlIsProfit ? "text-green-400" : pnlIsLoss ? "text-red-400" : "text-gray-400"
                                        }`}
                                >
                                    {pnlText}
                                </div>
                            </div>
                        );
                    })}

                </div>
            ) : (
                <div className="mt-8 text-center text-gray-500">
                    No open positions
                </div>
            )}
        </div>
    )
}