export interface OrderBookLevel {
    px: string;
    sz: string;
    n: number;
  }
  
  export interface OrderBookData {
    coin: string;
    levels: [OrderBookLevel[], OrderBookLevel[]];
    time: number;
  }
  
  export interface ProcessedLevel {
    price: number;
    size: number;
    sizeUsdc: number;
    total: number;
    totalUsdc: number;
    priceStr: string;
    isNew: boolean;
  }
  
  export interface TradeData {
    coin: string;
    side: string;
    px: string;
    sz: string;
    time: number;
    hash: string;
  }
  
  export interface ProcessedTrade {
    price: string;
    size: number;
    sizeUsdc: number;
    side: 'buy' | 'sell';
    time: string;
    timeMs: number;
    id: string;
  }

export interface TradeFormState {
  tradeAsset: Symbol | 'USDC',
  inputPrice: string;
  size: string;
  leverage: number;
  activeTradeTab: 'Long' | 'Short';
  markPrice: number | null;
  PNL: number | null;
}

export interface Position {
  id: string;
  date: number;
  tradeAsset: Symbol | 'USDC',
  inputPrice: string;
  size: string;
  activeTradeTab: 'Long' | 'Short';
} 

export interface PaperPosition {
  id: number;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  positionSize: number;
  margin: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  openedAt: string;
}

export interface PaperTrade {
  id: number;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  margin: number;
  leverage: number;
  realizedPnl: number;
  status: 'closed' | 'liquidated';
  openedAt: string;
  closedAt: string;
}

export type PaperOrderType = 'market' | 'limit' | 'stop_market';
export type PaperOrderStatus = 'open' | 'filled' | 'canceled' | 'rejected';

export interface PaperOrder {
  id: number;
  symbol: string;
  side: 'long' | 'short';
  orderType: PaperOrderType;
  status: PaperOrderStatus;
  positionSize: number;
  leverage: number;
  reduceOnly: boolean;
  limitPrice: number | null;
  stopPrice: number | null;
  attachedStopLossPrice: number | null;
  marginReserved: number;
  linkedPositionId: number | null;
  filledPrice: number | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  filledAt: string | null;
}
  
  export type Symbol = 'BTC' | 'ETH' | 'BTC_MOCK';
  export type Tab = 'orderbook' | 'trades';
  export type Denomination = 'asset' | 'usdc';
