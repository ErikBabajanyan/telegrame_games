import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { redis } from './redis.js';
import { logger } from '../utils/logger.js';

// Map userId → Set of WebSocket connections (supports multiple tabs/devices)
const clients = new Map<string, Set<WebSocket>>();

export function registerWebSocket(userId: string, socket: WebSocket): void {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(socket);
  logger.debug({ userId }, 'WebSocket client connected');
}

export function unregisterWebSocket(userId: string, socket: WebSocket): void {
  const userSockets = clients.get(userId);
  if (userSockets) {
    userSockets.delete(socket);
    if (userSockets.size === 0) {
      clients.delete(userId);
    }
  }
  logger.debug({ userId }, 'WebSocket client disconnected');
}

/** Send event to a specific user (all their connections) */
export function sendToUser(userId: string, event: string, payload: unknown): void {
  const userSockets = clients.get(userId);
  if (!userSockets) return;

  const message = JSON.stringify({ event, data: payload });
  for (const socket of userSockets) {
    if (socket.readyState === 1) {
      socket.send(message);
    }
  }
}

/** Broadcast event to all connected clients */
export function broadcast(event: string, payload: unknown): void {
  const message = JSON.stringify({ event, data: payload });
  for (const [, sockets] of clients) {
    for (const socket of sockets) {
      if (socket.readyState === 1) {
        socket.send(message);
      }
    }
  }
}

/** Setup Redis Pub/Sub listener for cross-instance fan-out */
export async function setupPubSub(): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.subscribe('pub:events');

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const { userId, event, data } = JSON.parse(message);
      if (userId) {
        sendToUser(userId, event, data);
      } else {
        broadcast(event, data);
      }
    } catch (err) {
      logger.error(err, 'Pub/Sub message parse error');
    }
  });

  logger.info('✅ WebSocket Pub/Sub listener active');
}

/** Publish event via Redis (for cross-instance delivery) */
export async function publishEvent(userId: string | null, event: string, data: unknown): Promise<void> {
  await redis.publish('pub:events', JSON.stringify({ userId, event, data }));
}

/** Register WebSocket route on Fastify */
export async function registerWebSocketRoute(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    let authenticatedUserId: string | null = null;

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.event === 'auth' && msg.token) {
          authenticatedUserId = msg.userId;
          if (authenticatedUserId) {
            registerWebSocket(authenticatedUserId, socket);
            socket.send(JSON.stringify({ event: 'auth:ok' }));
          }
        }

        if (msg.event === 'ping') {
          socket.send(JSON.stringify({ event: 'pong', data: { ts: Date.now() } }));
        }
      } catch {
        logger.warn('Invalid WebSocket message received');
      }
    });

    socket.on('close', () => {
      if (authenticatedUserId) {
        unregisterWebSocket(authenticatedUserId, socket);
      }
    });
  });
}
