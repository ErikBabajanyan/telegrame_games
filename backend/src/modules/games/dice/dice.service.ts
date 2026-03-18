import { DiceRound } from './dice.model.js';
import { Transaction } from '../../wallet/transaction.model.js';
import { redis, DEDUCT_BET_SCRIPT, CREDIT_BALANCE_SCRIPT, trackGameStats } from '../../../infrastructure/redis.js';
import { publishEvent } from '../../../infrastructure/websocket.js';
import { safeMongoWrite } from '../../../infrastructure/mongo-retry.js';
import { gameMetrics } from '../../../infrastructure/metrics.js';
import { logger } from '../../../utils/logger.js';
import { MIN_BET, DICE_MAX_BET, HISTORY_CACHE_TTL } from '../../../types/constants.js';
import type { DiceRollInput, DiceRollResult } from '../../../types/dice.types.js';
import { BadRequestError } from '../../../types/errors.js';
import { isValidTarget, winProbability, getMultiplier, rollDice } from './dice.engine.js';
import { getUserLuckFactor, checkRealtimeLuckAdjustment } from '../../../workers/luck.worker.js';

/**
 * Single atomic roll — no sessions, no game state.
 * Deducts bet → rolls → credits/forfeits → saves → returns.
 */
export async function roll({ userId, betAmount, target, mode }: DiceRollInput): Promise<DiceRollResult> {
  const startTime = Date.now();

  // 1. Validate
  if (betAmount < MIN_BET) throw new BadRequestError('Minimum bet is 0.01 TON');
  if (betAmount > DICE_MAX_BET) throw new BadRequestError('Maximum bet is 500 TON');
  if (!isValidTarget(target)) throw new BadRequestError('Target must be 2–98');
  if (mode !== 'under' && mode !== 'over') throw new BadRequestError('Mode must be "under" or "over"');

  const prob = winProbability(target, mode);
  if (prob <= 0) throw new BadRequestError('Invalid target for this mode');

  const mult = getMultiplier(target, mode);

  // 2. Deduct bet (with dirty flag)
  const newBalance = await redis.eval(DEDUCT_BET_SCRIPT, 1, `balance:${userId}`, betAmount.toString(), userId) as number;
  if (newBalance === -1) throw new BadRequestError('Insufficient balance');

  // 3. Roll (with per-game luck factor)
  const luckFactor = await getUserLuckFactor(userId, 'dice');
  const { result, win } = rollDice(target, mode, luckFactor);

  logger.debug({ userId, target, mode, result, win, luckFactor }, 'Dice roll');

  const payout = win ? Math.floor(betAmount * mult) : 0;

  // 4. Credit if won (with dirty flag)
  if (win) {
    await redis.eval(CREDIT_BALANCE_SCRIPT, 1, `balance:${userId}`, payout.toString(), userId);
  }

  // 5. Record transaction(s)
  await Transaction.create({
    userId, type: 'bet', amount: betAmount,
    balanceBefore: newBalance + betAmount, balanceAfter: newBalance,
    status: 'confirmed',
  });

  if (win) {
    const balanceAfterWin = newBalance + payout;
    await Transaction.create({
      userId, type: 'win', amount: payout,
      balanceBefore: newBalance, balanceAfter: balanceAfterWin,
      status: 'confirmed',
    });
  }

  // 6. Save round
  const round = await DiceRound.create({
    userId,
    gameType: 'dice',
    status: win ? 'won' : 'lost',
    betAmount,
    payoutAmount: payout,
    multiplier: win ? mult : 0,
    dice: { target, mode, result, winProbability: prob },
  });

  // 7. Durable balance sync (retries on failure)
  const finalBalance = win ? newBalance + payout : newBalance;
  safeMongoWrite(
    'balances',
    'updateOne',
    { userId },
    { $set: { available: finalBalance } },
    `dice balance sync for ${userId}`,
  );

  // 8. Track real-time stats + metrics
  await trackGameStats(userId, betAmount, payout, win, 'dice');
  checkRealtimeLuckAdjustment(userId); // fire-and-forget

  // Metrics
  gameMetrics.betPlaced('dice', betAmount);
  if (win) gameMetrics.gameWon('dice', payout);
  else gameMetrics.gameLost('dice');
  gameMetrics.betLatency('dice', Date.now() - startTime);

  // 9. Invalidate history cache
  await redis.del(`history:dice:${userId}:1`);

  // 10. Emit events
  await publishEvent(userId, 'wallet:balance', { available: finalBalance });

  logger.info({ userId, gameId: round._id, result, win, payout }, 'Dice roll complete');

  return {
    gameId: round._id.toString(),
    result,
    target,
    mode,
    win,
    winProbability: Math.round(prob * 1000) / 10,
    multiplier: mult,
    betAmount,
    payout,
    profit: win ? payout - betAmount : -betAmount,
  };
}

/** Dice game history (cached) */
export async function getGameHistory(userId: string, page: number = 1, limit: number = 20) {
  // Check cache for first page
  if (page === 1 && limit === 20) {
    const cached = await redis.get(`history:dice:${userId}:1`);
    if (cached) return JSON.parse(cached);
  }

  const skip = (page - 1) * limit;
  const [games, total] = await Promise.all([
    DiceRound.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).maxTimeMS(5000).lean(),
    DiceRound.countDocuments({ userId }).maxTimeMS(5000),
  ]);

  const result = {
    games: games.map((g) => ({
      gameId: g._id,
      status: g.status,
      betAmount: g.betAmount,
      payoutAmount: g.payoutAmount,
      multiplier: g.multiplier,
      target: g.dice.target,
      mode: g.dice.mode,
      result: g.dice.result,
      createdAt: g.createdAt,
    })),
    total, page, totalPages: Math.ceil(total / limit),
  };

  // Cache first page
  if (page === 1 && limit === 20) {
    await redis.set(`history:dice:${userId}:1`, JSON.stringify(result), 'EX', HISTORY_CACHE_TTL);
  }

  return result;
}
