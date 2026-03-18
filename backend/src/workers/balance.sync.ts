import { redis } from '../infrastructure/redis.js';
import { Balance } from '../modules/wallet/balance.model.js';
import { logger } from '../utils/logger.js';
import { gameMetrics } from '../infrastructure/metrics.js';
import { config } from '../config.js';
import { BALANCE_SYNC_INTERVAL } from '../types/constants.js';

let isRunning = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startBalanceSync(): void {
  if (isRunning) return;
  isRunning = true;

  syncTimer = setInterval(async () => {
    try {
      await syncDirtyBalances();
    } catch (error) {
      logger.error(error, 'Balance sync error');
    }
  }, BALANCE_SYNC_INTERVAL);

  logger.info('Balance sync worker started (dirty-flag pattern, every 30s)');
}

export function stopBalanceSync(): void {
  isRunning = false;
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  logger.info('Balance sync worker stopped');
}

/**
 * Dirty-flag pattern: only sync balances that were actually modified.
 * Instead of scanning ALL balance:* keys, we pop from a `balance:dirty` set
 * that gets populated by the Lua scripts on every bet/credit operation.
 */
async function syncDirtyBalances(): Promise<void> {
  const batchSize = config.BALANCE_SYNC_BATCH_SIZE;
  const startTime = Date.now();

  // SPOP atomically removes and returns up to `batchSize` dirty userIds
  const dirtyUserIds = await redis.spop('balance:dirty', batchSize) as string[];

  if (!dirtyUserIds || dirtyUserIds.length === 0) return;

  // Batch-read all balances in one pipeline
  const pipeline = redis.pipeline();
  for (const userId of dirtyUserIds) {
    pipeline.get(`balance:${userId}`);
  }
  const results = await pipeline.exec();

  // Batch-write to MongoDB using bulkWrite for efficiency
  const bulkOps = [];
  for (let i = 0; i < dirtyUserIds.length; i++) {
    const balance = results?.[i]?.[1];
    if (balance !== null && balance !== undefined) {
      bulkOps.push({
        updateOne: {
          filter: { userId: dirtyUserIds[i] },
          update: { $set: { available: Number(balance) } },
          upsert: true,
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await Balance.bulkWrite(bulkOps, { ordered: false });
  }

  const lagMs = Date.now() - startTime;
  gameMetrics.balanceSyncLag(lagMs);

  if (dirtyUserIds.length > 0) {
    logger.debug({ synced: dirtyUserIds.length, lagMs }, 'Balance sync completed');
  }
}

export async function syncUserBalance(userId: string): Promise<void> {
  const balance = await redis.get(`balance:${userId}`);
  if (balance !== null) await Balance.updateOne({ userId }, { available: Number(balance) });
}
