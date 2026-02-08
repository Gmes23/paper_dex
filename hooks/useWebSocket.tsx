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

export function useWebSocket({ 
  symbol, 
  onOrderBookUpdate, 
  onTradesUpdate,
  enabled = true,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const tradeCountRef = useRef(0);
  const lastTradeTimeRef = useRef<number | null>(null);
  const lastLogTimeRef = useRef(0);

  useEffect(() => {
    let ws: WebSocket;

    if (!enabled) {
      setIsConnected(false);
      return;
    }

    const connect = () => {
      try {
        ws = new WebSocket(API_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);

          // Subscribe to orderbook
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'l2Book',
              coin: symbol,
              nSigFigs: null,
            }
          }));
          
          // Subscribe to trades
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'trades',
              coin: symbol
            }
          }));
          
          console.log(`Subscribed to orderbook and trades for: ${symbol}`);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.channel === 'l2Book' && data.data) {
              onOrderBookUpdate(data.data);
            } else if (data.channel === 'trades' && data.data) {
              onTradesUpdate(data.data);
              tradeCountRef.current += Array.isArray(data.data) ? data.data.length : 1;
              const lastTrade = Array.isArray(data.data)
                ? data.data[data.data.length - 1]
                : data.data;
              if (lastTrade?.time) {
                lastTradeTimeRef.current = Number(lastTrade.time);
              }

              const now = Date.now();
              if (now - lastLogTimeRef.current > 5000) {
                lastLogTimeRef.current = now;
                console.log('[WebSocket] Trades received', {
                  symbol,
                  count: tradeCountRef.current,
                  lastTradeTime: lastTradeTimeRef.current
                    ? new Date(lastTradeTimeRef.current).toISOString()
                    : null,
                });
              }
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, RECONNECT_DELAY);
        };
      } catch (error) {
        console.error('Connection error:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'l2Book', coin: symbol }
        }));
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          subscription: { type: 'trades', coin: symbol }
        }));
        ws.close();
      }
    };
  }, [symbol, onOrderBookUpdate, onTradesUpdate, enabled]);

  return { isConnected };
}
