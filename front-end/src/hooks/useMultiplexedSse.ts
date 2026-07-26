import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export type SseConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface SseEvent<T = unknown> {
  instanceId: number;
  type: string;
  payload: T;
  timestamp: string;
}

export const useMultiplexedSse = (onEvent?: (event: SseEvent) => void) => {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [connectionStatus, setConnectionStatus] = useState<SseConnectionStatus>('disconnected');

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const reconnectTimeoutRef = useRef<number | null>(null);
  const connectRef = useRef<(() => EventSource | undefined) | null>(null);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatus('disconnected');
      return undefined;
    }

    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const cleanBaseURL = baseURL.replace(/\/+$/, '');
    const sseURL = `${cleanBaseURL}/whatsapp/instances/stream?token=${token}`;

    setConnectionStatus('connecting');
    const eventSource = new EventSource(sseURL);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
    };

    const handleEvent = (type: string) => (event: MessageEvent) => {
      try {
        const payload = event.data ? JSON.parse(event.data) : null;
        if (onEventRef.current && payload?.instanceId !== undefined) {
          onEventRef.current({ 
            instanceId: payload.instanceId,
            type, 
            payload, 
            timestamp: new Date().toISOString() 
          });
        }
      } catch (err) {
        console.error(`[SSE-Multi] Failed to parse payload for event ${type}:`, err);
      }
    };

    eventSource.addEventListener('qr', handleEvent('qr'));
    eventSource.addEventListener('connected', handleEvent('connected'));
    eventSource.addEventListener('disconnected', handleEvent('disconnected'));
    eventSource.addEventListener('qr:timeout', handleEvent('qr:timeout'));
    eventSource.addEventListener('health', handleEvent('health'));
    eventSource.addEventListener('heartbeat', () => { /* ignore */ });

    eventSource.onerror = (err) => {
      console.warn('[SSE-Multi] EventSource encountered error. Reconnecting...', err);
      eventSource.close();
      setConnectionStatus('disconnected');

      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectRef.current?.();
      }, 5000);
    };

    return eventSource;
  }, [token, isAuthenticated]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    let eventSource: EventSource | undefined;
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

  return { connectionStatus };
};

export default useMultiplexedSse;
