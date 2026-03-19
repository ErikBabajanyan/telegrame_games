import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerWebSocketRoute } from './infrastructure/websocket.js';
import { getPrometheusMetrics } from './infrastructure/metrics.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { minesRoutes } from './modules/games/mines/mines.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { hiloRoutes } from './modules/games/hilo/hilo.routes.js';
import { diceRoutes } from './modules/games/dice/dice.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use our own Pino logger
    requestTimeout: config.REQUEST_TIMEOUT_MS,
    bodyLimit: 1048576, // 1MB
  });

  // --- Plugins ---
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  // --- WebSocket route ---
  await registerWebSocketRoute(app);

  // --- TON Connect manifest ---
  app.get('/tonconnect-manifest.json', async (_request, reply) => {
    reply.header('Content-Type', 'application/json');
    reply.header('Access-Control-Allow-Origin', '*');
    return {
      url: 'https://telegrame-games.onrender.com',
      name: 'Mini Games Casino',
      iconUrl: 'https://telegrame-games.onrender.com/icon.png',
    };
  });

  // --- App icon (for TON Connect) ---
  app.get('/icon.png', async (_request, reply) => {
    // Minimal 1x1 purple PNG placeholder — replace with a real icon later
    const buf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    reply.header('Content-Type', 'image/png');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(buf);
  });

  // --- Health check (enhanced) ---
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  // --- Prometheus metrics endpoint ---
  if (config.METRICS_ENABLED) {
    app.get('/metrics', async (_request, reply) => {
      const metrics = await getPrometheusMetrics();
      reply.header('Content-Type', 'text/plain; version=0.0.4');
      return metrics;
    });
  }

  // --- API routes ---
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(minesRoutes, { prefix: '/api/v1/games/mines' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.register(hiloRoutes, { prefix: '/api/v1/games/hilo' });
  await app.register(diceRoutes, { prefix: '/api/v1/games/dice' });
  // await app.register(userRoutes, { prefix: '/api/v1/user' });

  // --- Global error handler ---
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');

    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.message,
    });
  });

  return app;
}
