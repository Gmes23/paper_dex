import { CandleAggregator } from '@/services/candleAggregator';
import { HyperliquidWebSocketService } from '@/services/websocketService';
import { startLiquidationService, type LiquidationServiceHandle } from '@/services/liquidationService';

type ServicesState = {
  started: boolean;
  aggregator: CandleAggregator | null;
  websocket: HyperliquidWebSocketService | null;
  liquidation: LiquidationServiceHandle;
  liveIngestionEnabled: boolean;
  startedAt: number;
};

declare global {
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

  const wsSource = (process.env.NEXT_PUBLIC_WS_SOURCE ?? 'mock').toLowerCase();
  const liveIngestionEnabled = wsSource === 'live';

  let aggregator: CandleAggregator | null = null;
  let websocket: HyperliquidWebSocketService | null = null;

  if (liveIngestionEnabled) {
    const flushIntervalMs = Number(process.env.CANDLE_FLUSH_INTERVAL_MS ?? 5000);
    aggregator = new CandleAggregator({
      flushIntervalMs: Number.isFinite(flushIntervalMs) ? flushIntervalMs : 5000,
    });
    websocket = new HyperliquidWebSocketService({
      symbols: parseSymbols(),
      aggregator,
    });

    aggregator.start();
    websocket.connect();
  } else {
    console.log('[Services] Live websocket ingestion disabled', { wsSource });
  }

  const liquidation = startLiquidationService();

  const shutdown = async () => {
    console.log('[Services] Shutting down...');
    liquidation.stop();

    if (websocket) websocket.disconnect();
    if (aggregator) {
      aggregator.stop();
      await aggregator.flushCandles('shutdown');
    }
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
    liquidation,
    liveIngestionEnabled,
    startedAt: Date.now(),
  };
}

export function getServicesState() {
  return globalThis.__servicesState;
}
