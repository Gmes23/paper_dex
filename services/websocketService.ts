import WebSocket from 'ws';
import { CandleAggregator } from '@/services/candleAggregator';

type WebSocketServiceOptions = {
  symbols: string[];
  aggregator: CandleAggregator;
};

type HyperliquidTrade = {
  coin: string;
  px: string;
  sz: string;
  time: number;
  side?: string;
};

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const BASE_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;

export class HyperliquidWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = BASE_RECONNECT_MS;
  private shouldReconnect = true;
  private symbols: string[];
  private aggregator: CandleAggregator;
  private connected = false;
  private lastMessageAt: number | null = null;
  private lastTradeAt: number | null = null;
  private loggedNonTrades = false;

  constructor(options: WebSocketServiceOptions) {
    this.symbols = options.symbols.map((s) => s.toUpperCase());
    this.aggregator = options.aggregator;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.ws) return;

    console.log('[WebSocket] Connecting to Hyperliquid...');
    this.ws = new WebSocket(WS_URL);

    this.ws.on('open', () => {
      console.log('[WebSocket] Connected to Hyperliquid');
      this.connected = true;
      this.reconnectDelay = BASE_RECONNECT_MS;

      this.symbols.forEach((coin) => {
        const payload = {
          method: 'subscribe',
          subscription: {
            type: 'trades',
            coin,
          },
        };
        this.ws?.send(JSON.stringify(payload));
      });
    });

    this.ws.on('message', (raw: WebSocket.Data) => {
      try {
        this.lastMessageAt = Date.now();
        const message = JSON.parse(raw.toString());
        const channel = message?.channel ?? message?.type;
        const data = message?.data ?? message?.trades ?? message?.result;

        if (channel !== 'trades' || !Array.isArray(data)) {
          if (!this.loggedNonTrades) {
            this.loggedNonTrades = true;
            console.log('[WebSocket] Non-trade message received', {
              channel,
              hasData: Boolean(data),
            });
          }
          return;
        }

        data.forEach((trade: HyperliquidTrade) => {
          if (!trade?.coin) return;
          if (Number.isFinite(Number(trade.time))) {
            this.lastTradeAt = Number(trade.time);
          }
          this.aggregator.addTrade(trade);
        });
      } catch (err) {
        console.error('[WebSocket] Failed to parse message', err);
      }
    });

    this.ws.on('error', (err: Error) => {
      console.error('[WebSocket] Error:', err);
    });

    this.ws.on('close', () => {
      console.warn('[WebSocket] Disconnected from Hyperliquid');
      this.connected = false;
      this.ws = null;
      if (this.shouldReconnect) this.scheduleReconnect();
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  getStats() {
    return {
      connected: this.connected,
      symbols: this.symbols,
      reconnectDelayMs: this.reconnectDelay,
      lastMessageAt: this.lastMessageAt,
      lastTradeAt: this.lastTradeAt,
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);

    console.log(`[WebSocket] Reconnecting in ${Math.round(delay / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) this.connect();
    }, delay);
  }
}
