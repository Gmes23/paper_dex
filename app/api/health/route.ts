import { NextResponse } from 'next/server';
import { getServicesState } from '@/services';

export async function GET() {
  const state = getServicesState();

  if (!state?.started) {
    return NextResponse.json({
      status: 'not_started',
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    startedAt: state.startedAt,
    liveIngestionEnabled: state.liveIngestionEnabled,
    websocket: state.websocket?.getStats() ?? null,
    aggregator: state.aggregator?.getStats() ?? null,
    liquidation: state.liquidation.getStats(),
  });
}
