import { Queue, Worker, type Job } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { gameMetrics } from './metrics.js';
import mongoose from 'mongoose';

/**
 * BullMQ-backed retry queue for MongoDB writes that must not be silently lost.
 * Replaces fire-and-forget `.catch()` patterns with durable retries.
 */

const redisUrl = new URL(config.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
};

export interface MongoWriteJob {
  collection: string;
  operation: 'updateOne' | 'insertOne';
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  description: string;  // human-readable description for logging
}

export const mongoWriteQueue = new Queue<MongoWriteJob>('mongo-writes', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 10000 },
  },
});

/**
 * Enqueue a MongoDB write for durable retry.
 * Use this instead of `Model.updateOne().catch()` for critical writes.
 */
export async function enqueueMongoWrite(job: MongoWriteJob): Promise<void> {
  await mongoWriteQueue.add('mongo-write', job);
}

/**
 * Perform a MongoDB write with immediate attempt + fallback to retry queue.
 * If the immediate write fails, it's queued for background retry.
 */
export async function safeMongoWrite(
  collection: string,
  operation: 'updateOne' | 'insertOne',
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
  description: string,
): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB not connected');

    if (operation === 'updateOne') {
      await db.collection(collection).updateOne(filter, update);
    } else {
      await db.collection(collection).insertOne(update);
    }
  } catch (err) {
    logger.warn({ err, collection, description }, 'MongoDB write failed, enqueueing for retry');
    gameMetrics.mongoWriteRetry(collection);
    await enqueueMongoWrite({ collection, operation, filter, update, description });
  }
}

// ─── Worker ───

let worker: Worker<MongoWriteJob> | null = null;

export function startMongoRetryWorker(): void {
  worker = new Worker<MongoWriteJob>(
    'mongo-writes',
    async (job: Job<MongoWriteJob>) => {
      const { collection, operation, filter, update, description } = job.data;
      const db = mongoose.connection.db;
      if (!db) throw new Error('MongoDB not connected');

      if (operation === 'updateOne') {
        await db.collection(collection).updateOne(filter, update);
      } else {
        await db.collection(collection).insertOne(update);
      }

      logger.debug({ collection, description, attempt: job.attemptsMade + 1 }, 'Mongo retry write succeeded');
    },
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, error) => {
    if (!job) return;
    const { collection, description } = job.data;
    if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
      logger.error({ collection, description, error: error.message }, 'Mongo write permanently failed');
      gameMetrics.mongoWriteFailed(collection);
    }
  });

  logger.info('Mongo retry worker started (concurrency: 5)');
}

export function stopMongoRetryWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
}
