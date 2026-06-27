import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export type SseConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface SseEvent<T = any> {
  type: string;
  payload: T;
  timestamp: string;
}

export const useSseGateway = (onEvent?: (event: SseEvent) => void) => {
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

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatus('disconnected');
      return;
    }

    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    // Clean trailing slash if present
    const cleanBaseURL = baseURL.replace(/\/+$/, '');
    const sseURL = `${cleanBaseURL}/whatsapp/qr/stream?token=${token}`;

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
          connect();
        }, delay);

        return nextCount;
      });
    };

    return eventSource;
  }, [token, isAuthenticated]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
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
