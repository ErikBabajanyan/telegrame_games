import { Worker, type Job } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { WithdrawalRequest } from '../modules/wallet/withdrawal.model.js';
import { Transaction } from '../modules/wallet/transaction.model.js';
import { sendWithdrawal } from '../modules/wallet/ton.bridge.js';
import { publishEvent } from '../infrastructure/websocket.js';
import type { WithdrawalJobData } from '../types/wallet.types.js';

const redisUrl = new URL(config.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
};

export const withdrawalWorker = new Worker<WithdrawalJobData>(
  'withdrawals',
  async (job: Job<WithdrawalJobData>) => {
    const { requestId, userId, toAddress, amount } = job.data;
    logger.info({ requestId, userId, amount }, 'Processing withdrawal');

    await WithdrawalRequest.updateOne({ _id: requestId }, { status: 'processing' });
    await publishEvent(userId, 'withdrawal:status', { requestId, status: 'processing' });

    const result = await sendWithdrawal(toAddress, amount);
    if (!result.success || !result.txHash) {
      throw new Error(`Withdrawal tx failed for request ${requestId}`);
    }

    await WithdrawalRequest.updateOne({ _id: requestId }, { status: 'sent', txHash: result.txHash });
    await Transaction.updateOne({ userId, type: 'withdrawal', status: 'pending' }, { status: 'confirmed', txHash: result.txHash });
    await publishEvent(userId, 'withdrawal:status', { requestId, status: 'sent', txHash: result.txHash });

    logger.info({ requestId, txHash: result.txHash }, 'Withdrawal sent successfully');
  },
  { connection, concurrency: config.WITHDRAWAL_CONCURRENCY },
);

withdrawalWorker.on('failed', async (job, error) => {
  if (!job) return;
  const { requestId, userId } = job.data;
  logger.error({ requestId, attempt: job.attemptsMade, error: error.message }, 'Withdrawal job failed');

  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await WithdrawalRequest.updateOne({ _id: requestId }, { status: 'failed', retries: job.attemptsMade });
    await publishEvent(userId, 'withdrawal:status', { requestId, status: 'failed' });
    logger.error({ requestId }, 'Withdrawal permanently failed — needs manual review');
  }
});

logger.info({ concurrency: config.WITHDRAWAL_CONCURRENCY }, 'Withdrawal worker started');
