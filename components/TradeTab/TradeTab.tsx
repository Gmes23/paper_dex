import type { Symbol, TradeFormState } from '@/lib/types';
import { Dropdown } from '@/components/ui/Dropdown';

interface TradeTableProps {
    symbol: Symbol;
    openMenu: string | null;
    setOpenMenu: (menu: string | null) => void;
    onTradeFormChange: (value: Partial<TradeFormState>) => void;
    tradeForm: TradeFormState;
    onPositionSubmit: () => void;
}

export function TradeTab({
    symbol,
    setOpenMenu,
    openMenu,
    onTradeFormChange,
    tradeForm,
    onPositionSubmit
}: TradeTableProps) {




    return (
        <div className="grid grid-cols-6 bg-[#131722] text-white">
            <div>
                cross
            </div>
            <div>
                20x
            </div>
            <div>
                classic
            </div>
            <div>
                Market
            </div>
            <div>
                Limit
            </div>
            <div>
                Pro
            </div>

            <div className="col-span-6 flex justify-center">
                <button
                    className={`min-w-[11rem] min-h-[2.75rem] rounded-xl cursor-pointer transition ${tradeForm.activeTradeTab === 'Long' ? 'bg-teal-500' : 'bg-gray-400'}`}
                    onClick={() => 
                    onTradeFormChange({activeTradeTab:'Long'})}>

                    Buy/Long
                </button>

                <button className={`min-w-[11rem] min-h-[2.75rem] rounded-xl
                cursor-pointer transition ${tradeForm.activeTradeTab === 'Short' ? 'bg-rose-400' : 'bg-gray-400'}`}
                    onClick={() => onTradeFormChange({activeTradeTab: 'Short'})
                    }>
                    Sell/Short
                </button>
            </div>

            <div className="col-span-6 flex flex-col gap-1 p-[1rem]">
                <div className="flex justify-between ">
                    <div>
                        Avalaible to Trade
                    </div>
                    <div>
                        3000
                    </div>
                </div>

                <div className="flex justify-between">
                    <div>
                        Current Position
                    </div>
                    <div>
                        3000
                    </div>
                </div>
            </div>

            <div className="col-span-6 flex flex-col gap-2">
                <div className="relative w-full
                bg-transparent border rounded-xl flex text-white justify-between p-2
                transition-colors
                hover:border-teal-400
                focus-within:border-teal-400
                focus-within:ring-1
                focus-within:ring-teal-400
                ">
                    {/* Fake placeholder */}
                    {!tradeForm.inputPrice && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            Price (USDC)
                        </span>
                    )}
                    <input
                        name="inputPrice"
                        id="inputPriceField"
                        className="w-full bg-transparent appearance-none outline-none text-right pr-2"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={tradeForm.inputPrice}
                        onChange={(e) => {
                            const onlyNumbers = e.target.value.replace(/\D/g, '');
                            onTradeFormChange({inputPrice: onlyNumbers});
                        }}
                    />
                    <button className="text-teal-400 mr-2">
                        Mid
                    </button>

                </div>

                <div className="relative w-full
                bg-transparent border rounded-xl flex text-white justify-between p-2
                transition-colors
                hover:border-teal-400
                focus-within:border-teal-400
                focus-within:ring-1
                focus-within:ring-teal-400
                ">
                    {/* Fake placeholder */}
                    {!tradeForm.size && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            Size
                        </span>
                    )}
                    <input
                        name="size"
                        id="sizeField"
                        className="w-full text-right bg-transparent appearance-none outline-none"
                        value={tradeForm.size}
                        onChange={(e) => {
                            const onlyNumbers = e.target.value.replace(/\D/g, '');

                            onTradeFormChange({size: onlyNumbers})
                        }}
                    />
                    <Dropdown
                        value={tradeForm.tradeAsset}
                        onChange={(val) => {
                            onTradeFormChange({tradeAsset: val})
                            setOpenMenu(null)
                        }}
                        options={[
                            { key: symbol + '1', label: symbol, value: symbol },
                            { key: 'USDC-1', label: 'USDC', value: 'USDC' }
                        ]}
                        isOpen={openMenu === 'tradeAsset'}
                        onToggle={() => {
                            setOpenMenu(openMenu === 'tradeAsset' ? null : 'tradeAsset')
                        }}
                    />
                </div>
            </div>
            <div className="col-span-6 flex justify-center">
                <button 
                className={`${tradeForm.activeTradeTab === "Long" ? 'bg-green-400' : 'bg-red-400'} cursor-pointer text-white rounded-2xl min-w-[11rem] min-h-[2.75rem] m-2`}
                onClick={onPositionSubmit}
                >
                {tradeForm.activeTradeTab === "Long" ? 'Long' : 'Short'} 
                </button>
            </div>
        </div>
    )
}