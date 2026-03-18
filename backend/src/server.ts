import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { connectMongoDB, disconnectMongoDB } from './infrastructure/mongodb.js';
import { connectRedis, disconnectRedis } from './infrastructure/redis.js';
import { setupPubSub } from './infrastructure/websocket.js';
import { startMongoRetryWorker, stopMongoRetryWorker } from './infrastructure/mongo-retry.js';
import { startDepositListener, stopDepositListener } from './workers/deposit.listener.js';
import { startBalanceSync, stopBalanceSync } from './workers/balance.sync.js';
import { startLuckWorker, stopLuckWorker } from './workers/luck.worker.js';

async function start() {
  // 1. Connect to databases
  await connectMongoDB();
  await connectRedis();
  await setupPubSub();

  // 2. Build Fastify app
  const app = await buildApp();

  // 3. Start background workers
  startBalanceSync();
  startDepositListener();
  startLuckWorker();
  startMongoRetryWorker();

  // Note: withdrawal.worker.ts runs as a separate process in production
  // In development, you can import it here to start inline:
  if (config.NODE_ENV === 'development') {
    await import('./workers/withdrawal.worker.js');
  }

  // 4. Start listening
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`Server running on http://localhost:${config.PORT}`);
  logger.info(`WebSocket available at ws://localhost:${config.PORT}/ws`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  if (config.METRICS_ENABLED) {
    logger.info(`Metrics available at http://localhost:${config.PORT}/metrics`);
  }

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    stopBalanceSync();
    stopDepositListener();
    stopLuckWorker();
    stopMongoRetryWorker();
    await app.close();
    await disconnectMongoDB();
    await disconnectRedis();
    logger.info('Server shut down complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});
