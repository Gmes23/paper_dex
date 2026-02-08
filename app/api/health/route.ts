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
    websocket: state.websocket.getStats(),
    aggregator: state.aggregator.getStats(),
  });
}
