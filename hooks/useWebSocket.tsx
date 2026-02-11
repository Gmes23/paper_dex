'use client';

import { useEffect, useRef, useState } from 'react';
import { API_URL, RECONNECT_DELAY } from '@/lib/constants';
import type { Symbol, OrderBookData, TradeData } from '@/lib/types';

interface UseWebSocketProps {
  symbol: Symbol;
  onOrderBookUpdate: (data: OrderBookData) => void;
  onTradesUpdate: (data: TradeData[]) => void;
  enabled?: boolean;
}

export type WebSocketConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export function useWebSocket({
  symbol,
  onOrderBookUpdate,
  onTradesUpdate,
  enabled = true,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>(
    enabled ? 'connecting' : 'idle'
  );
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasConnectedOnceRef = useRef(false);
  const reconnectingRef = useRef(false);
  const orderBookCbRef = useRef(onOrderBookUpdate);
  const tradesCbRef = useRef(onTradesUpdate);

  // logging for race conditon, can be removed
  // const tradeCountRef = useRef(0);
  // const lastTradeTimeRef = useRef<number | null>(null);
  // const lastLogTimeRef = useRef(0);

  useEffect(() => {
    orderBookCbRef.current = onOrderBookUpdate;
  }, [onOrderBookUpdate]);

  useEffect(() => {
    tradesCbRef.current = onTradesUpdate;
  }, [onTradesUpdate]);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled || !enabled) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setConnectionState(hasConnectedOnceRef.current || reconnectingRef.current ? 'reconnecting' : 'connecting');
      const ws = new WebSocket(API_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || wsRef.current !== ws) {
          ws.close();
          return;
        }

        // console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionState('connected');
        setReconnectAttempt(0);
        reconnectingRef.current = false;
        hasConnectedOnceRef.current = true;

        ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'l2Book',
            coin: symbol,
            nSigFigs: null,
          }
        }));

        ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'trades',
            coin: symbol
          }
        }));

        // console.log(`Subscribed to orderbook and trades for: ${symbol}`);
      };

      ws.onmessage = (event) => {
        if (cancelled || wsRef.current !== ws) return;

        try {
          const data = JSON.parse(event.data);

          if (data.channel === 'l2Book' && data.data) {
            setLastMessageAt(Date.now());
            orderBookCbRef.current(data.data);
          } else if (data.channel === 'trades' && data.data) {
            setLastMessageAt(Date.now());
            tradesCbRef.current(data.data);


            // logging for worker race conditon, can be removed
            // tradeCountRef.current += Array.isArray(data.data) ? data.data.length : 1;
            // const lastTrade = Array.isArray(data.data)
            //   ? data.data[data.data.length - 1]
            //   : data.data;
            // if (lastTrade?.time) {
            //   lastTradeTimeRef.current = Number(lastTrade.time);
            // }

            // const now = Date.now();
            // if (now - lastLogTimeRef.current > 5000) {
            //   lastLogTimeRef.current = now;
            //   console.log('[WebSocket] Trades received', {
            //     symbol,
            //     count: tradeCountRef.current,
            //     lastTradeTime: lastTradeTimeRef.current
            //       ? new Date(lastTradeTimeRef.current).toISOString()
            //       : null,
            //   });
            // }



          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = () => {
        if (cancelled || wsRef.current !== ws) return;
        // console.error('WebSocket error:', error);
        setIsConnected(false);
        if (enabled) {
          setConnectionState('reconnecting');
          reconnectingRef.current = true;
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (cancelled) return;

        // console.log('WebSocket disconnected');
        setIsConnected(false);
        if (!enabled) {
          setConnectionState('idle');
          return;
        }
        setConnectionState('reconnecting');
        reconnectingRef.current = true;
        setReconnectAttempt((prev) => prev + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (cancelled) return;
          // console.log('Attempting to reconnect...');
          connect();
        }, RECONNECT_DELAY);
      };
    };

    if (enabled) {
      connect();
    }

    return () => {
      cancelled = true;
      reconnectingRef.current = false;
      hasConnectedOnceRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'l2Book', coin: symbol }
        }));
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'trades', coin: symbol }
        }));
      }

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [symbol, enabled]);

  return {
    isConnected: enabled ? isConnected : false,
    connectionState: enabled ? connectionState : 'idle',
    reconnectAttempt: enabled ? reconnectAttempt : 0,
    lastMessageAt: enabled ? lastMessageAt : null,
  };
}
