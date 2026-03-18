import { Queue } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const redisUrl = new URL(config.REDIS_URL);

export const bullmqConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
};

export const withdrawalQueue = new Queue('withdrawals', {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 10000 },
  },
});

withdrawalQueue.on('error', (err) => {
  logger.error(err, 'Withdrawal queue error');
});

logger.info('BullMQ withdrawal queue initialized');
