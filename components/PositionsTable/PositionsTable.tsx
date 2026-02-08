import type { PaperPosition } from '@/lib/types';

interface PositionsTableProps {
    userPositions: PaperPosition[];
    markPrice: number | null;
    onClosePosition: (id: number) => void;
}


export function PositionsTable({
    userPositions,
    markPrice,
    onClosePosition
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
        { key: 'Positions' + 3, label: 'Size (BTC)' },
        { key: 'Positions' + 4, label: 'Position (USDC)' },
        { key: 'Entry Price', label: 'Entry Price' },
        { key: 'Mark Price', label: 'Mark Price' },
        { key: 'PNL', label: 'PNL (ROE%)' },
        { key: 'lid price', label: 'liq price' },
        { key: 'liq dist', label: 'liq dist' }
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
                    {userPositions.map((position: PaperPosition) => {
                        const entry = Number(position.entryPrice);
                        const size = Number(position.positionSize);
                        const mark = markPrice;
                        const dir = position.side === 'long' ? 1 : -1;
                        const baseQty = entry > 0 ? size / entry : 0;

                        const pnlSigned =
                            mark != null
                                ? ((mark - entry) / entry) * size * dir
                                : null;
                        const roe = pnlSigned != null && position.margin > 0
                            ? (pnlSigned / position.margin) * 100
                            : null;
                        const liqDistance = mark != null && position.liquidationPrice > 0
                            ? (position.side === 'long'
                                ? ((mark - position.liquidationPrice) / mark) * 100
                                : ((position.liquidationPrice - mark) / mark) * 100)
                            : null;

                        const pnlIsProfit = pnlSigned != null && pnlSigned > 0;
                        const pnlIsLoss = pnlSigned != null && pnlSigned < 0;

                        const pnlText =
                            pnlSigned == null
                                ? "—"
                                : `${pnlSigned >= 0 ? "+" : "-"}${Math.abs(pnlSigned).toFixed(2)}`;
                        const roeText = roe == null ? "—" : `${roe >= 0 ? "+" : ""}${roe.toFixed(2)}%`;
                        const liqText = liqDistance == null ? "—" : `${liqDistance.toFixed(2)}%`;
                        const liqWarn = liqDistance != null && liqDistance <= 2;
                        const liqDanger = liqDistance != null && liqDistance <= 1;

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
                                    {position.side === 'long' ? 'Long' : 'Short'}
                                </div>

                                {/* Coin */}
                                <div className="min-w-[4.75rem]">{position.symbol}</div>

                                {/* Size */}
                                <div className="min-w-[4.75rem]">{baseQty.toFixed(4)}</div>

                                {/* Position Value */}
                                <div className="min-w-[4.75rem]">{position.positionSize.toFixed(2)}</div>

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
                                    {pnlText} <span className="text-xs text-gray-400">({roeText})</span>
                                </div>
                                <div className="min-w-[4.75rem]">
                                    {Number.isFinite(position.liquidationPrice)
                                        ? `$${position.liquidationPrice.toFixed(2)}`
                                        : '—'}
                                </div>
                                <div
                                    className={`min-w-[4.75rem] ${
                                        liqDanger ? 'text-red-400' : liqWarn ? 'text-yellow-400' : 'text-gray-400'
                                    }`}
                                >
                                    {liqText}
                                </div>
                                <button
                                    onClick={() => onClosePosition(position.id)}
                                    className="ml-2 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                                >
                                    Close
                                </button>
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
