import { redis, getRealtimeStats } from '../infrastructure/redis.js';
import { logger } from '../utils/logger.js';
import { gameMetrics } from '../infrastructure/metrics.js';
import {
  LUCK_DEFAULT, LUCK_MIN, LUCK_MAX, LUCK_RECALC_INTERVAL,
  LUCK_PROFIT_WEIGHT, LUCK_WINRATE_THRESHOLD, LUCK_WINRATE_WEIGHT, LUCK_SMOOTHING,
  LUCK_REALTIME_PROFIT_THRESHOLD,
} from '../types/constants.js';

let isRunning = false;
let luckTimer: ReturnType<typeof setInterval> | null = null;

export function startLuckWorker(): void {
  if (isRunning) return;
  isRunning = true;

  recalculateAllLuckFactors().catch((err) => logger.error(err, 'Initial luck calculation failed'));

  luckTimer = setInterval(async () => {
    try { await recalculateAllLuckFactors(); }
    catch (error) { logger.error(error, 'Luck worker error'); }
  }, LUCK_RECALC_INTERVAL);

  logger.info('Luck factor worker started (hybrid: real-time + hourly batch)');
}

export function stopLuckWorker(): void {
  isRunning = false;
  if (luckTimer) { clearInterval(luckTimer); luckTimer = null; }
  logger.info('Luck factor worker stopped');
}

/**
 * Batch recalculation using Redis counters instead of MongoDB aggregation.
 * Scans stats:*:bets keys to find active users, then reads their counters.
 */
async function recalculateAllLuckFactors(): Promise<void> {
  const startTime = Date.now();
  const activeUserIds = new Set<string>();

  // Scan for users with stats keys
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'stats:*:bets', 'COUNT', 200);
    cursor = nextCursor;
    for (const key of keys) {
      // Extract userId from stats:{userId}:bets (skip per-game keys like stats:{id}:dice:bets)
      const parts = key.split(':');
      if (parts.length === 3) {
        activeUserIds.add(parts[1]);
      }
    }
  } while (cursor !== '0');

  let updated = 0;

  for (const userId of activeUserIds) {
    try {
      const factor = await calculateUserLuckFactorFromRedis(userId);
      await redis.set(`luck:${userId}`, factor.toFixed(4));
      updated++;
    } catch (err) {
      logger.error({ userId, err }, 'Failed to calculate luck factor');
    }
  }

  const duration = Date.now() - startTime;
  gameMetrics.luckRecalcDuration(duration);

  if (updated > 0) logger.info({ usersUpdated: updated, durationMs: duration }, 'Luck factors recalculated');
}

/**
 * Calculate luck factor from Redis counters (no MongoDB hit).
 */
async function calculateUserLuckFactorFromRedis(userId: string): Promise<number> {
  const stats = await getRealtimeStats(userId);

  if (stats.totalGames === 0) return LUCK_DEFAULT;

  const { totalGames, totalBet, totalPayout, wins } = stats;
  const netProfit = totalPayout - totalBet;
  const winRate = wins / totalGames;

  const currentFactor = parseFloat(await redis.get(`luck:${userId}`) ?? LUCK_DEFAULT.toString());
  const profitRatio = totalBet > 0 ? netProfit / totalBet : 0;

  let targetFactor = LUCK_DEFAULT + (profitRatio * LUCK_PROFIT_WEIGHT);

  if (winRate > LUCK_WINRATE_THRESHOLD) {
    targetFactor += (winRate - LUCK_WINRATE_THRESHOLD) * LUCK_WINRATE_WEIGHT;
  }

  targetFactor = Math.min(LUCK_MAX, Math.max(LUCK_MIN, targetFactor));

  const newFactor = currentFactor + (targetFactor - currentFactor) * LUCK_SMOOTHING;
  return Math.min(LUCK_MAX, Math.max(LUCK_MIN, newFactor));
}

/**
 * Real-time luck check: called after each bet to detect significant profit spikes.
 * If net profit exceeds threshold, immediately recalculates the user's luck factor.
 * This prevents a player from winning big within the 1-hour batch window.
 */
export async function checkRealtimeLuckAdjustment(userId: string): Promise<void> {
  try {
    const netProfit = Number(await redis.get(`stats:${userId}:netProfit`) ?? 0);

    if (netProfit > LUCK_REALTIME_PROFIT_THRESHOLD) {
      const factor = await calculateUserLuckFactorFromRedis(userId);
      await redis.set(`luck:${userId}`, factor.toFixed(4));
      logger.info({ userId, netProfit, newFactor: factor }, 'Real-time luck adjustment triggered');
    }
  } catch (err) {
    // Non-critical — don't break the bet flow
    logger.debug({ userId, err }, 'Real-time luck check failed (non-critical)');
  }
}

/**
 * Get per-game-type luck factor.
 * Falls back to global luck factor if no game-specific data exists.
 */
export async function getUserLuckFactor(userId: string, gameType?: string): Promise<number> {
  // Check for per-game-type override first
  if (gameType) {
    const gameStats = await getRealtimeStats(userId, gameType);
    if (gameStats.totalGames >= 20) {
      // Enough data to calculate per-game luck
      const globalFactor = parseFloat(await redis.get(`luck:${userId}`) ?? LUCK_DEFAULT.toString());
      const profitRatio = gameStats.totalBet > 0 ? (gameStats.totalPayout - gameStats.totalBet) / gameStats.totalBet : 0;
      const winRate = gameStats.wins / gameStats.totalGames;

      let gameTargetFactor = LUCK_DEFAULT + (profitRatio * LUCK_PROFIT_WEIGHT);
      if (winRate > LUCK_WINRATE_THRESHOLD) {
        gameTargetFactor += (winRate - LUCK_WINRATE_THRESHOLD) * LUCK_WINRATE_WEIGHT;
      }
      gameTargetFactor = Math.min(LUCK_MAX, Math.max(LUCK_MIN, gameTargetFactor));

      // Blend: 60% game-specific, 40% global
      const blended = gameTargetFactor * 0.6 + globalFactor * 0.4;
      return Math.min(LUCK_MAX, Math.max(LUCK_MIN, blended));
    }
  }

  // Fallback to global factor
  const factor = await redis.get(`luck:${userId}`);
  return factor ? parseFloat(factor) : LUCK_DEFAULT;
}

export async function setUserLuckFactor(userId: string, factor: number): Promise<void> {
  const clamped = Math.min(LUCK_MAX, Math.max(LUCK_MIN, factor));
  await redis.set(`luck:${userId}`, clamped.toFixed(4));
  logger.info({ userId, luckFactor: clamped }, 'Luck factor manually set');
}
