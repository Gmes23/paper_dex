import { CandleAggregator } from '@/services/candleAggregator';
import { HyperliquidWebSocketService } from '@/services/websocketService';
import { startLiquidationService } from '@/services/liquidationService';

type ServicesState = {
  started: boolean;
  aggregator: CandleAggregator;
  websocket: HyperliquidWebSocketService;
  startedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __servicesState: ServicesState | undefined;
}

function parseSymbols() {
  const raw = process.env.WS_SYMBOLS ?? 'BTC,ETH,SOL,ARB';
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function initializeServices() {
  if (globalThis.__servicesState?.started) return;

  console.log('[Services] Initializing background services...');
  console.log('[Services] DB target', {
    host: process.env.PGHOST ?? 'localhost',
    port: process.env.PGPORT ?? '5432',
    database: process.env.PGDATABASE ?? 'fakeprices',
    user: process.env.PGUSER ?? 'gm',
    hasPassword: Boolean(process.env.PGPASSWORD),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  });

  const flushIntervalMs = Number(process.env.CANDLE_FLUSH_INTERVAL_MS ?? 5000);
  const aggregator = new CandleAggregator({
    flushIntervalMs: Number.isFinite(flushIntervalMs) ? flushIntervalMs : 5000,
  });
  const websocket = new HyperliquidWebSocketService({
    symbols: parseSymbols(),
    aggregator,
  });

  aggregator.start();
  websocket.connect();
  startLiquidationService();

  const shutdown = async () => {
    console.log('[Services] Shutting down...');
    websocket.disconnect();
    aggregator.stop();
    await aggregator.flushCandles('shutdown');
  };

  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });

  globalThis.__servicesState = {
    started: true,
    aggregator,
    websocket,
    startedAt: Date.now(),
  };
}

export function getServicesState() {
  return globalThis.__servicesState;
}
