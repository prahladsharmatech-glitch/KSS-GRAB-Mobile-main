/**
 * useRealtimeOrders — Real-time order data hook for delivery portals
 *
 * Strategy (Vercel-compatible, no WebSockets):
 *   • Web (Expo Web / Browser): Uses EventSource (SSE) for true push-based real-time updates
 *   • Native (iOS/Android):     Falls back to fast 3-second polling with cache bypass
 *
 * Usage:
 *   const { orders, loading, error, refresh, isLive } = useRealtimeOrders('seller');
 *   const { orders, loading, error, refresh, isLive } = useRealtimeOrders('rider');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { get, getApiBaseUrl, invalidateOrdersCache } from './api';

export type RealtimeRole = 'seller' | 'rider' | 'admin';

export interface UseRealtimeOrdersResult {
  orders: any[];
  loading: boolean;
  error: string | null;
  isLive: boolean;        // true when SSE is actively connected
  refresh: () => void;   // manual refresh trigger
}

const SSE_POLL_INTERVAL_MS = 3000;     // 3s polling on native
const MAX_RECONNECT_DELAY_MS = 30000;  // max backoff cap

function getOrdersEndpoint(role: RealtimeRole): string {
  return role === 'rider' ? '/delivery/active' : '/orders';
}

function getSseEndpoint(role: RealtimeRole): string {
  return role === 'rider' ? '/delivery/stream' : '/orders/stream';
}

// ──────────────────────────────────────────────────────────────────────────────
// Web SSE hook (EventSource)
// ──────────────────────────────────────────────────────────────────────────────
function useSSEOrders(role: RealtimeRole): UseRealtimeOrdersResult {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const baseUrl = getApiBaseUrl();
    const sseUrl = `${baseUrl}${getSseEndpoint(role)}`;

    try {
      const es = new EventSource(sseUrl, { withCredentials: false });
      esRef.current = es;

      es.addEventListener('orders_update', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          if (Array.isArray(data)) {
            setOrders(data);
            setLoading(false);
            setError(null);
            setIsLive(true);
            retryCountRef.current = 0;
          }
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener('heartbeat', () => {
        setIsLive(true);
        setLoading(false);
      });

      es.addEventListener('error', () => {
        setIsLive(false);
        es.close();
        esRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RECONNECT_DELAY_MS);
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(connect, delay);
      });

    } catch (e) {
      setIsLive(false);
      setLoading(false);
      setError('SSE connection failed');
    }
  }, [role]);

  // Initial connection + cleanup
  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);

  const refresh = useCallback(() => {
    invalidateOrdersCache();
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return { orders, loading, error, isLive, refresh };
}

// ──────────────────────────────────────────────────────────────────────────────
// Native polling hook (3-second interval, cache-bypassed)
// ──────────────────────────────────────────────────────────────────────────────
function usePollingOrders(role: RealtimeRole): UseRealtimeOrdersResult {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOrders = useCallback(async () => {
    invalidateOrdersCache();
    try {
      const endpoint = getOrdersEndpoint(role);
      const res = await get(endpoint);
      if (!mountedRef.current) return;

      let fetched: any[] = [];
      if (Array.isArray(res)) {
        fetched = res;
      } else if (res && Array.isArray((res as any).orders)) {
        fetched = (res as any).orders;
      }

      // Filter out terminal orders for rider
      if (role === 'rider') {
        fetched = fetched.filter((o: any) => {
          const st = String(o.status || '').toLowerCase();
          return st !== 'delivered' && st !== 'cancelled' && st !== 'failed_delivery';
        });
      }

      setOrders(fetched);
      setError(null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to fetch orders');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();
    const interval = setInterval(fetchOrders, SSE_POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchOrders]);

  return { orders, loading, error, isLive: false, refresh: fetchOrders };
}

// ──────────────────────────────────────────────────────────────────────────────
// Unified hook — auto-selects SSE on web, polling on native
// ──────────────────────────────────────────────────────────────────────────────
export function useRealtimeOrders(role: RealtimeRole): UseRealtimeOrdersResult {
  const isWeb = Platform.OS === 'web' && typeof EventSource !== 'undefined';

  // Hooks must be called unconditionally — call both, use one
  const sseResult = useSSEOrders(role);
  const pollResult = usePollingOrders(role);

  return isWeb ? sseResult : pollResult;
}
