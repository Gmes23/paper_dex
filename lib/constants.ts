export const BTC_GROUP_OPTIONS = [1, 2, 5, 10];
export const ETH_GROUP_OPTIONS = [0.1, 0.2, 0.5, 1];
export const NUM_ROWS = 15;
export const API_URL = 'wss://api.hyperliquid.xyz/ws';
export const MAX_TRADES = 50;
export const RECONNECT_DELAY = 3000;
export const WS_SOURCE = (process.env.NEXT_PUBLIC_WS_SOURCE ?? 'mock') as 'mock' | 'live';
