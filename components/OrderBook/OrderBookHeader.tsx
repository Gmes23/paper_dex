import type { Symbol, Tab, Denomination } from '@/lib/types';
import { Dropdown } from '@/components/ui/Dropdown';
import { TabSelector } from '@/components/ui/TabSelector';
import { formatGrouping } from '@/lib/utils';
import { BTC_GROUP_OPTIONS, ETH_GROUP_OPTIONS } from '@/lib/constants';

interface OrderBookHeaderProps {
  symbol: Symbol;
  setSymbol: (symbol: Symbol) => void;
  priceGrouping: number;
  setPriceGrouping: (grouping: number) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  denomination: Denomination;
  setDenomination: (denom: Denomination) => void;
  isConnected: boolean;
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
}

export function OrderBookHeader({
  symbol,
  setSymbol,
  priceGrouping,
  setPriceGrouping,
  activeTab,
  setActiveTab,
  denomination,
  setDenomination,
  isConnected,
  openMenu,
  setOpenMenu
}: OrderBookHeaderProps) {
  const groupOptions = symbol === 'BTC' ? BTC_GROUP_OPTIONS : ETH_GROUP_OPTIONS;

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold">
            {symbol === 'BTC' ? '₿' : 'Ξ'}
          </div>
          
          <div>
            <div className="font-semibold">{symbol}-USD</div>
            <div className="text-xs muted-text">Perpetuals</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          
          {/* Price Grouping Dropdown */}
          <Dropdown
            value={priceGrouping}
            onChange={(val) => {
              setPriceGrouping(val);
              setOpenMenu(null);   
            }}
            options={groupOptions.map(opt => ({
              label: formatGrouping(opt),
              value: opt,
            }))}
            isOpen={openMenu === 'priceGrouping'}
            onToggle={() =>
              setOpenMenu(openMenu === 'priceGrouping' ? null : 'priceGrouping')
            }
          />
          
          {/* Symbol Selector */}
          <Dropdown
            value={symbol}
            onChange={(val) => {
              setSymbol(val as Symbol);
              setOpenMenu(null); 
            }}
            options={[
              { label: 'BTC', value: 'BTC' },
              { label: 'ETH', value: 'ETH' },
            ]}
            isOpen={openMenu === 'symbol'}
            onToggle={() =>
              setOpenMenu(openMenu === 'symbol' ? null : 'symbol')
            }
          />
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center justify-between border-b border-white/10">
        <TabSelector
          tabs={[
            { id: 'orderbook', label: 'Orders' },
            { id: 'trades', label: 'Trades' }
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as Tab)}
        />
        
        {/* Denomination Toggle */}
        <div className="flex items-center gap-1 pb-2">
          <button
            onClick={() => setDenomination('asset')}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer active:scale-[0.97] ${
              denomination === 'asset'
                ? 'bg-orange-500 text-white'
                : 'glass-button text-gray-300 hover:text-white'
            }`}
          >
            {symbol}
          </button>
          <button
            onClick={() => setDenomination('usdc')}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer active:scale-[0.97] ${
              denomination === 'usdc'
                ? 'bg-orange-500 text-white'
                : 'glass-button text-gray-300 hover:text-white'
            }`}
          >
            USDC
          </button>
        </div>
      </div>
    </div>
  );
}
