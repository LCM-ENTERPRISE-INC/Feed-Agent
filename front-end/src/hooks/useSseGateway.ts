import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export type SseConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface SseEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

export const useSseGateway = (instanceId: number, onEvent?: (event: SseEvent) => void) => {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [connectionStatus, setConnectionStatus] = useState<SseConnectionStatus>('disconnected');
  const [errorCount, setErrorCount] = useState(0);

  // Keep callback reference mutable to avoid recreating effect on listener change
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const reconnectTimeoutRef = useRef<number | null>(null);
  // Ref avoids accessing `connect` before its useCallback binding is initialized
  const connectRef = useRef<(() => EventSource | undefined) | null>(null);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatus('disconnected');
      return undefined;
    }

    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    // Clean trailing slash if present
    const cleanBaseURL = baseURL.replace(/\/+$/, '');
    const sseURL = `${cleanBaseURL}/whatsapp/instances/${instanceId}/stream?token=${token}`;

    setConnectionStatus('connecting');
    const eventSource = new EventSource(sseURL);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setErrorCount(0);
    };

    // Helper to process named events
    const handleEvent = (type: string) => (event: MessageEvent) => {
      try {
        const payload = event.data ? JSON.parse(event.data) : null;
        if (onEventRef.current) {
          onEventRef.current({ type, payload, timestamp: new Date().toISOString() });
        }
      } catch (err) {
        console.error(`[SSE] Failed to parse payload for event ${type}:`, err);
      }
    };

    eventSource.addEventListener('qr', handleEvent('qr'));
    eventSource.addEventListener('connected', handleEvent('connected'));
    eventSource.addEventListener('disconnected', handleEvent('disconnected'));
    eventSource.addEventListener('qr:timeout', handleEvent('qr:timeout'));
    eventSource.addEventListener('heartbeat', () => { /* ignore heartbeat */ });

    eventSource.onerror = (err) => {
      console.warn('[SSE] EventSource connection encountered error. Reconnecting...', err);
      eventSource.close();
      setConnectionStatus('disconnected');

      // Schedule exponential backoff reconnect
      setErrorCount((prev) => {
        const nextCount = prev + 1;
        const delay = Math.min(1000 * Math.pow(2, nextCount), 30000); // Max delay of 30s

        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current?.();
        }, delay);

        return nextCount;
      });
    };

    return eventSource;
  }, [token, isAuthenticated, instanceId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    let eventSource: EventSource | undefined;
    // Defer connect so synchronous setState inside connect is not treated as cascading
    const boot = window.setTimeout(() => {
      eventSource = connect();
    }, 0);

    return () => {
      window.clearTimeout(boot);
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    errorCount,
  };
};

export default useSseGateway;
