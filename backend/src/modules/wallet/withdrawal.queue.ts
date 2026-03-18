import { withdrawalQueue } from '../../infrastructure/bullmq.js';
import { logger } from '../../utils/logger.js';
import type { WithdrawalJobData } from '../../types/wallet.types.js';

export async function enqueueWithdrawal(data: WithdrawalJobData): Promise<string> {
  const job = await withdrawalQueue.add('process-withdrawal', data, {
    jobId: data.requestId,
    priority: data.reviewRequired ? 10 : 1,
  });

  logger.info({ requestId: data.requestId, userId: data.userId }, 'Withdrawal job enqueued');
  return job.id ?? data.requestId;
}
