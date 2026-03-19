import { useEffect, useRef } from 'react';
import { useWalletStore } from '../stores/useWalletStore';

function getWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) return envUrl;
  // Build from current page host — works with tunnels and proxies
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
const PING_INTERVAL = 30_000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const setBalance = useWalletStore((s) => s.setBalance);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate
      ws.send(JSON.stringify({ event: 'auth', token }));

      // Start ping keep-alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'ping', ts: Date.now() }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.event) {
          case 'wallet:balance':
            if (msg.data?.available !== undefined) {
              setBalance(msg.data.available);
            }
            break;
          case 'wallet:deposit_confirmed':
            // Balance already updated via wallet:balance event
            break;
          // Game events are handled by the mines store via REST responses
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [setBalance]);

  return wsRef;
}
