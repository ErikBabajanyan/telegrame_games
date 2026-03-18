import { HiLoGame, type IHiLoGame } from './hilo.model.js';
import { Transaction } from '../../wallet/transaction.model.js';
import { redis, DEDUCT_BET_SCRIPT, CREDIT_BALANCE_SCRIPT, trackGameStats } from '../../../infrastructure/redis.js';
import { publishEvent } from '../../../infrastructure/websocket.js';
import { safeMongoWrite } from '../../../infrastructure/mongo-retry.js';
import { gameMetrics } from '../../../infrastructure/metrics.js';
import { logger } from '../../../utils/logger.js';
import { ACTIVE_GAME_TTL, MIN_BET, HILO_MAX_BET, HILO_MAX_SKIPS, HISTORY_CACHE_TTL } from '../../../types/constants.js';
import type { HiLoGuess, HiLoStartResult, HiLoGuessResult, HiLoSkipResult, HiLoCashOutResult, HiLoActiveState } from '../../../types/hilo.types.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../../types/errors.js';
import { randomCard, getMultipliers, rollGuess, guessMultiplier } from './hilo.engine.js';
import { getUserLuckFactor, checkRealtimeLuckAdjustment } from '../../../workers/luck.worker.js';

// ─── Start Game ───

export async function startGame(userId: string, betAmount: number): Promise<HiLoStartResult> {
  if (betAmount < MIN_BET) throw new BadRequestError('Minimum bet is 0.01 TON');
  if (betAmount > HILO_MAX_BET) throw new BadRequestError('Maximum bet is 500 TON');

  const activeGame = await redis.get(`session:${userId}:game`);
  if (activeGame) throw new ConflictError('You already have an active game');

  const newBalance = await redis.eval(DEDUCT_BET_SCRIPT, 1, `balance:${userId}`, betAmount.toString(), userId) as number;
  if (newBalance === -1) throw new BadRequestError('Insufficient balance');

  const firstCard = randomCard();
  const mults = getMultipliers(firstCard.value);

  const game = await HiLoGame.create({
    userId,
    gameType: 'hilo',
    status: 'active',
    betAmount,
    hilo: {
      currentCard: firstCard,
      history: [],
      roundNumber: 1,
      skipsUsed: 0,
      maxSkips: HILO_MAX_SKIPS,
    },
  });

  await redis.set(`session:${userId}:game`, game._id.toString(), 'EX', ACTIVE_GAME_TTL);

  await Transaction.create({
    userId, type: 'bet', amount: betAmount,
    balanceBefore: newBalance + betAmount, balanceAfter: newBalance,
    gameRoundId: game._id, status: 'confirmed',
  });

  safeMongoWrite(
    'balances',
    'updateOne',
    { userId },
    { $set: { available: newBalance }, $inc: { locked: betAmount } },
    `hilo start balance sync for ${userId}`,
  );

  gameMetrics.betPlaced('hilo', betAmount);
  await publishEvent(userId, 'wallet:balance', { available: newBalance });
  logger.info({ userId, gameId: game._id, betAmount }, 'HiLo game started');

  return {
    gameId: game._id.toString(),
    currentCard: firstCard,
    roundNumber: 1,
    ...mults,
  };
}

// ─── Guess ───

export async function makeGuess(userId: string, gameId: string, guess: HiLoGuess): Promise<HiLoGuessResult> {
  const startTime = Date.now();
  const game = await HiLoGame.findOne({ _id: gameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) throw new NotFoundError('Game not found or not active');

  const currentCard = game.hilo.currentCard;
  const luckFactor = await getUserLuckFactor(userId, 'hilo');

  // Validate guess is possible
  const mults = getMultipliers(currentCard.value);
  if (guess === 'higher' && mults.hiMultiplier === 0) {
    throw new BadRequestError('Cannot guess higher on a King');
  }
  if (guess === 'lower' && mults.loMultiplier === 0) {
    throw new BadRequestError('Cannot guess lower on an Ace');
  }

  const { isCorrect, card: nextCard } = rollGuess(currentCard.value, guess, luckFactor);

  logger.debug({ userId, gameId, guess, currentValue: currentCard.value, nextValue: nextCard.value, isCorrect, luckFactor }, 'HiLo guess');

  const roundMult = guess === 'higher'
    ? guessMultiplier(mults.hiProbability / 100)
    : guessMultiplier(mults.loProbability / 100);

  // Add to history
  game.hilo.history.push({
    card: currentCard,
    guess,
    result: isCorrect ? 'correct' : 'wrong',
    roundMultiplier: Math.floor(roundMult * 100) / 100,
  });

  if (!isCorrect) {
    // ─── WRONG GUESS ───
    game.status = 'lost';
    game.payoutAmount = 0;
    game.multiplier = 0;
    game.hilo.currentCard = nextCard;
    game.endedAt = new Date();
    await game.save();

    await redis.del(`session:${userId}:game`);
    safeMongoWrite(
      'balances',
      'updateOne',
      { userId },
      { $inc: { locked: -game.betAmount } },
      `hilo loss unlock for ${userId}`,
    );

    // Track stats + metrics
    await trackGameStats(userId, game.betAmount, 0, false, 'hilo');
    gameMetrics.gameLost('hilo');
    gameMetrics.betLatency('hilo', Date.now() - startTime);
    await redis.del(`history:hilo:${userId}:1`);

    await publishEvent(userId, 'game:over', { gameId, reason: 'wrong_guess' });
    logger.info({ userId, gameId, guess }, 'HiLo wrong guess — game lost');

    return {
      correct: false,
      nextCard,
      previousCard: currentCard,
      guess,
      roundMultiplier: Math.floor(roundMult * 100) / 100,
      totalMultiplier: 0,
      currentPayout: 0,
      roundNumber: game.hilo.roundNumber,
    };
  }

  // ─── CORRECT GUESS ───
  const totalMultiplier = game.hilo.history.reduce((acc, r) => {
    return r.result === 'correct' ? acc * r.roundMultiplier : acc;
  }, 1);

  const currentPayout = Math.floor(game.betAmount * totalMultiplier);

  game.hilo.currentCard = nextCard;
  game.hilo.roundNumber += 1;
  game.multiplier = totalMultiplier;
  game.payoutAmount = currentPayout;
  await game.save();

  const nextMults = getMultipliers(nextCard.value);

  gameMetrics.betLatency('hilo', Date.now() - startTime);

  await publishEvent(userId, 'game:cell_revealed', {
    gameId, result: 'correct', card: nextCard, multiplier: totalMultiplier, payout: currentPayout,
  });

  return {
    correct: true,
    nextCard,
    previousCard: currentCard,
    guess,
    roundMultiplier: Math.floor(roundMult * 100) / 100,
    totalMultiplier: Math.floor(totalMultiplier * 100) / 100,
    currentPayout,
    roundNumber: game.hilo.roundNumber,
    ...nextMults,
  };
}

// ─── Skip ───

export async function skipCard(userId: string, gameId: string): Promise<HiLoSkipResult> {
  const game = await HiLoGame.findOne({ _id: gameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) throw new NotFoundError('Game not found or not active');

  if (game.hilo.skipsUsed >= game.hilo.maxSkips) {
    throw new BadRequestError(`No skips remaining (max ${game.hilo.maxSkips})`);
  }

  const newCard = randomCard();
  game.hilo.currentCard = newCard;
  game.hilo.skipsUsed += 1;
  game.hilo.roundNumber += 1;
  await game.save();

  const mults = getMultipliers(newCard.value);

  logger.debug({ userId, gameId, newCard, skipsUsed: game.hilo.skipsUsed }, 'HiLo card skipped');

  return {
    newCard,
    skipsRemaining: game.hilo.maxSkips - game.hilo.skipsUsed,
    roundNumber: game.hilo.roundNumber,
    ...mults,
  };
}

// ─── Cash Out ───

export async function cashOut(userId: string, gameId: string): Promise<HiLoCashOutResult> {
  const game = await HiLoGame.findOne({ _id: gameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) throw new NotFoundError('Game not found or not active');

  const correctGuesses = game.hilo.history.filter((r) => r.result === 'correct').length;
  if (correctGuesses === 0) throw new BadRequestError('Must make at least 1 correct guess before cashing out');

  const totalMultiplier = game.hilo.history.reduce((acc, r) => {
    return r.result === 'correct' ? acc * r.roundMultiplier : acc;
  }, 1);

  const payout = Math.floor(game.betAmount * totalMultiplier);

  game.status = 'cashout';
  game.multiplier = totalMultiplier;
  game.payoutAmount = payout;
  game.endedAt = new Date();
  await game.save();

  await creditWinnings(userId, game);

  // Track stats + metrics
  await trackGameStats(userId, game.betAmount, payout, true, 'hilo');
  checkRealtimeLuckAdjustment(userId);
  gameMetrics.gameWon('hilo', payout);
  await redis.del(`history:hilo:${userId}:1`);

  logger.info({ userId, gameId, payout, multiplier: totalMultiplier }, 'HiLo cash out');

  return {
    payout,
    multiplier: Math.floor(totalMultiplier * 100) / 100,
    profit: payout - game.betAmount,
    rounds: correctGuesses,
  };
}

// ─── Credit Winnings ───

async function creditWinnings(userId: string, game: IHiLoGame): Promise<void> {
  const payout = game.payoutAmount;
  await redis.del(`session:${userId}:game`);

  const newBalance = await redis.eval(CREDIT_BALANCE_SCRIPT, 1, `balance:${userId}`, payout.toString(), userId) as number;

  await Transaction.create({
    userId, type: 'win', amount: payout,
    balanceBefore: newBalance - payout, balanceAfter: newBalance,
    gameRoundId: game._id, status: 'confirmed',
  });

  safeMongoWrite(
    'balances',
    'updateOne',
    { userId },
    { $set: { available: newBalance }, $inc: { locked: -game.betAmount } },
    `hilo cashout balance sync for ${userId}`,
  );

  await publishEvent(userId, 'game:over', { gameId: game._id.toString(), reason: 'cashout' });
  await publishEvent(userId, 'wallet:balance', { available: newBalance });
}

// ─── Get Active Game ───

export async function getActiveGame(userId: string): Promise<HiLoActiveState | null> {
  const activeGameId = await redis.get(`session:${userId}:game`);
  if (!activeGameId) return null;

  const game = await HiLoGame.findOne({ _id: activeGameId, userId, status: 'active', gameType: 'hilo' }).maxTimeMS(5000);
  if (!game) return null;

  const totalMultiplier = game.hilo.history.reduce((acc, r) => {
    return r.result === 'correct' ? acc * r.roundMultiplier : acc;
  }, 1);
  const currentPayout = Math.floor(game.betAmount * totalMultiplier);
  const mults = getMultipliers(game.hilo.currentCard.value);

  return {
    gameId: game._id.toString(),
    status: game.status,
    betAmount: game.betAmount,
    currentCard: game.hilo.currentCard,
    history: game.hilo.history,
    roundNumber: game.hilo.roundNumber,
    currentMultiplier: Math.floor(totalMultiplier * 100) / 100,
    currentPayout,
    skipsRemaining: game.hilo.maxSkips - game.hilo.skipsUsed,
    ...mults,
  };
}

// ─── Game History (cached) ───

export async function getGameHistory(userId: string, page: number = 1, limit: number = 20) {
  // Check cache for first page
  if (page === 1 && limit === 20) {
    const cached = await redis.get(`history:hilo:${userId}:1`);
    if (cached) return JSON.parse(cached);
  }

  const skip = (page - 1) * limit;
  const [games, total] = await Promise.all([
    HiLoGame.find({ userId, gameType: 'hilo' }).sort({ createdAt: -1 }).skip(skip).limit(limit).maxTimeMS(5000).lean(),
    HiLoGame.countDocuments({ userId, gameType: 'hilo' }).maxTimeMS(5000),
  ]);

  const result = {
    games: games.map((g) => ({
      gameId: g._id,
      status: g.status,
      betAmount: g.betAmount,
      payoutAmount: g.payoutAmount,
      multiplier: g.multiplier,
      rounds: g.hilo?.history?.length ?? 0,
      createdAt: g.createdAt,
      endedAt: g.endedAt,
    })),
    total, page, totalPages: Math.ceil(total / limit),
  };

  // Cache first page
  if (page === 1 && limit === 20) {
    await redis.set(`history:hilo:${userId}:1`, JSON.stringify(result), 'EX', HISTORY_CACHE_TTL);
  }

  return result;
}
