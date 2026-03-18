import { GameRound, type IGameRound } from './mines.model.js';
import { Transaction } from '../../wallet/transaction.model.js';
import { redis, DEDUCT_BET_SCRIPT, CREDIT_BALANCE_SCRIPT, trackGameStats } from '@infrastructure/redis.js';
import { publishEvent } from '@infrastructure/websocket.js';
import { safeMongoWrite } from '@infrastructure/mongo-retry.js';
import { gameMetrics } from '@infrastructure/metrics.js';
import { incrementNonce, getUserById } from '../../users/user.service.js';
import { logger } from '@utils/logger.js';
import { ACTIVE_GAME_TTL, GRID_SIZE, HISTORY_CACHE_TTL } from '../../../types/constants.js';
import type { StartGameInput, RevealCellInput, StartGameResult, RevealResult, CashOutResult, ActiveGameState } from '../../../types/game.types.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../../types/errors.js';
import {
  generateServerSeed, hashServerSeed, rollMine, generateRemainingMinePositions,
  appliedMultiplier, calculatePayout, isValidMineCount, getMaxBet, MIN_BET, maxReveals,
} from './mines.engine.js';
import { getUserLuckFactor, checkRealtimeLuckAdjustment } from '../../../workers/luck.worker.js';

// ─── Start Game ───

export async function startGame({ userId, betAmount, mineCount }: StartGameInput): Promise<StartGameResult> {
  if (!isValidMineCount(mineCount)) {
    throw new BadRequestError('Invalid mine count. Choose 1–24');
  }
  if (betAmount < MIN_BET) {
    throw new BadRequestError('Minimum bet is 0.01 TON');
  }
  const maxBet = getMaxBet(mineCount);
  if (betAmount > maxBet) {
    throw new BadRequestError(`Maximum bet for ${mineCount} mines is ${maxBet / 1_000_000_000} TON`);
  }

  const activeGame = await redis.get(`session:${userId}:game`);
  if (activeGame) {
    throw new ConflictError('You already have an active game');
  }

  const newBalance = await redis.eval(DEDUCT_BET_SCRIPT, 1, `balance:${userId}`, betAmount.toString(), userId) as number;
  if (newBalance === -1) {
    throw new BadRequestError('Insufficient balance');
  }

  const user = await getUserById(userId);
  if (!user) {
    await redis.eval(CREDIT_BALANCE_SCRIPT, 1, `balance:${userId}`, betAmount.toString(), userId);
    throw new NotFoundError('User not found');
  }
  const nonce = await incrementNonce(userId);

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);

  const gameRound = await GameRound.create({
    userId,
    gameType: 'mines',
    status: 'active',
    betAmount,
    provablyFair: { serverSeed, serverSeedHash, clientSeed: user.clientSeed, nonce },
    mines: { mineCount, minePositions: [], revealedCells: [] },
  });

  await redis.set(`session:${userId}:game`, gameRound._id.toString(), 'EX', ACTIVE_GAME_TTL);

  await Transaction.create({
    userId, type: 'bet', amount: betAmount,
    balanceBefore: newBalance + betAmount, balanceAfter: newBalance,
    gameRoundId: gameRound._id, status: 'confirmed',
  });

  safeMongoWrite(
    'balances',
    'updateOne',
    { userId },
    { $set: { available: newBalance }, $inc: { locked: betAmount } },
    `mines start balance sync for ${userId}`,
  );

  gameMetrics.betPlaced('mines', betAmount);
  await publishEvent(userId, 'wallet:balance', { available: newBalance, locked: betAmount });
  logger.info({ userId, gameId: gameRound._id, betAmount, mineCount }, 'Game started');

  return { gameId: gameRound._id.toString(), serverSeedHash, clientSeed: user.clientSeed, nonce };
}

// ─── Reveal Cell ───

export async function revealCell({ userId, gameId, cellIndex }: RevealCellInput): Promise<RevealResult> {
  const startTime = Date.now();

  if (cellIndex < 0 || cellIndex > 24 || !Number.isInteger(cellIndex)) {
    throw new BadRequestError('Cell index must be 0-24');
  }

  const game = await GameRound.findOne({ _id: gameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) {
    throw new NotFoundError('Game not found or not active');
  }

  if (game.mines.revealedCells.includes(cellIndex)) {
    throw new BadRequestError('Cell already revealed');
  }

  const luckFactor = await getUserLuckFactor(userId, 'mines');
  const revealedSafeCount = game.mines.revealedCells.length;
  const isMine = rollMine(game.mines.mineCount, revealedSafeCount, luckFactor);

  logger.debug({ userId, gameId, cellIndex, luckFactor, result: isMine ? 'mine' : 'gem' }, 'Cell reveal roll');

  game.mines.revealedCells.push(cellIndex);

  if (isMine) {
    const displayPositions = generateRemainingMinePositions(
      cellIndex, game.mines.revealedCells.filter((c) => c !== cellIndex), game.mines.mineCount,
    );

    game.status = 'lost';
    game.payoutAmount = 0;
    game.multiplier = 0;
    game.mines.minePositions = displayPositions;
    game.endedAt = new Date();
    await game.save();

    await redis.del(`session:${userId}:game`);
    safeMongoWrite(
      'balances',
      'updateOne',
      { userId },
      { $inc: { locked: -game.betAmount } },
      `mines loss unlock for ${userId}`,
    );

    // Track stats + metrics
    await trackGameStats(userId, game.betAmount, 0, false, 'mines');
    gameMetrics.gameLost('mines');
    gameMetrics.betLatency('mines', Date.now() - startTime);
    await redis.del(`history:mines:${userId}:1`);

    await publishEvent(userId, 'game:cell_revealed', { gameId, cellIndex, result: 'mine', multiplier: 0, payout: 0, revealedCount: game.mines.revealedCells.length });
    await publishEvent(userId, 'game:over', { gameId, reason: 'mine', minePositions: displayPositions });

    return { result: 'mine', cellIndex, currentMultiplier: 0, currentPayout: 0, revealedCount: game.mines.revealedCells.length, minePositions: displayPositions };
  }

  // GEM
  const revealedCount = game.mines.revealedCells.length;
  const currentMultiplier = appliedMultiplier(revealedCount, game.mines.mineCount);
  const currentPayout = calculatePayout(game.betAmount, revealedCount, game.mines.mineCount);

  game.multiplier = currentMultiplier;
  game.payoutAmount = currentPayout;

  if (revealedCount >= maxReveals(game.mines.mineCount)) {
    const allRevealed = new Set(game.mines.revealedCells);
    const minePositions = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !allRevealed.has(i));
    game.mines.minePositions = minePositions;
    game.status = 'cashout';
    game.endedAt = new Date();
    await game.save();

    await creditWinnings(userId, game);

    // Track stats
    await trackGameStats(userId, game.betAmount, currentPayout, true, 'mines');
    checkRealtimeLuckAdjustment(userId);
    gameMetrics.gameWon('mines', currentPayout);
    gameMetrics.betLatency('mines', Date.now() - startTime);
    await redis.del(`history:mines:${userId}:1`);

    return { result: 'gem', cellIndex, currentMultiplier, currentPayout, revealedCount, autoCashout: true, minePositions };
  }

  await game.save();
  gameMetrics.betLatency('mines', Date.now() - startTime);

  await publishEvent(userId, 'game:cell_revealed', { gameId, cellIndex, result: 'gem', multiplier: currentMultiplier, payout: currentPayout, revealedCount });

  return { result: 'gem', cellIndex, currentMultiplier, currentPayout, revealedCount, autoCashout: false };
}

// ─── Cash Out ───

export async function cashOut(userId: string, gameId: string): Promise<CashOutResult> {
  const game = await GameRound.findOne({ _id: gameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) throw new NotFoundError('Game not found or not active');
  if (game.mines.revealedCells.length === 0) throw new BadRequestError('Must reveal at least 1 cell before cashing out');

  const revealedCount = game.mines.revealedCells.length;
  const finalMultiplier = appliedMultiplier(revealedCount, game.mines.mineCount);
  const payout = calculatePayout(game.betAmount, revealedCount, game.mines.mineCount);

  const allRevealed = new Set(game.mines.revealedCells);
  const unrevealed = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !allRevealed.has(i));
  const displayPositions = [...unrevealed].sort(() => Math.random() - 0.5).slice(0, game.mines.mineCount).sort((a, b) => a - b);

  game.status = 'cashout';
  game.multiplier = finalMultiplier;
  game.payoutAmount = payout;
  game.mines.minePositions = displayPositions;
  game.endedAt = new Date();
  await game.save();

  await creditWinnings(userId, game);

  // Track stats + metrics
  await trackGameStats(userId, game.betAmount, payout, true, 'mines');
  checkRealtimeLuckAdjustment(userId);
  gameMetrics.gameWon('mines', payout);
  await redis.del(`history:mines:${userId}:1`);

  logger.info({ userId, gameId, payout, multiplier: finalMultiplier }, 'Cash out successful');

  return { payout, multiplier: finalMultiplier, profit: payout - game.betAmount, minePositions: displayPositions };
}

// ─── Credit Winnings ───

async function creditWinnings(userId: string, game: IGameRound): Promise<void> {
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
    `mines cashout balance sync for ${userId}`,
  );

  await publishEvent(userId, 'game:over', { gameId: game._id.toString(), reason: 'cashout', minePositions: game.mines.minePositions });
  await publishEvent(userId, 'wallet:balance', { available: newBalance });
}

// ─── Get Active Game ───

export async function getActiveGame(userId: string): Promise<ActiveGameState | null> {
  const activeGameId = await redis.get(`session:${userId}:game`);
  if (!activeGameId) return null;

  const game = await GameRound.findOne({ _id: activeGameId, userId, status: 'active' }).maxTimeMS(5000);
  if (!game) {
    await redis.del(`session:${userId}:game`);
    return null;
  }

  const revealedCount = game.mines.revealedCells.length;
  const currentMultiplier = revealedCount > 0 ? appliedMultiplier(revealedCount, game.mines.mineCount) : 1;
  const currentPayout = revealedCount > 0 ? calculatePayout(game.betAmount, revealedCount, game.mines.mineCount) : 0;

  return {
    gameId: game._id.toString(),
    status: game.status,
    betAmount: game.betAmount,
    mineCount: game.mines.mineCount,
    revealedCells: game.mines.revealedCells,
    revealedCount,
    currentMultiplier,
    currentPayout,
    cells: Array.from({ length: GRID_SIZE }, (_, i) => ({
      index: i,
      status: game.mines.revealedCells.includes(i) ? 'gem' as const : 'hidden' as const,
    })),
    serverSeedHash: game.provablyFair.serverSeedHash,
    clientSeed: game.provablyFair.clientSeed,
    nonce: game.provablyFair.nonce,
  };
}

// ─── Game History (cached) ───

export async function getGameHistory(userId: string, page: number = 1, limit: number = 20) {
  // Check cache for first page
  if (page === 1 && limit === 20) {
    const cached = await redis.get(`history:mines:${userId}:1`);
    if (cached) return JSON.parse(cached);
  }

  const skip = (page - 1) * limit;
  const [games, total] = await Promise.all([
    GameRound.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-provablyFair.serverSeed').maxTimeMS(5000).lean(),
    GameRound.countDocuments({ userId }).maxTimeMS(5000),
  ]);

  const result = {
    games: games.map((g) => ({
      gameId: g._id,
      gameType: g.gameType,
      status: g.status,
      betAmount: g.betAmount,
      payoutAmount: g.payoutAmount,
      multiplier: g.multiplier,
      mineCount: g.mines?.mineCount,
      revealedCount: g.mines?.revealedCells?.length ?? 0,
      createdAt: g.createdAt,
      endedAt: g.endedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };

  // Cache first page
  if (page === 1 && limit === 20) {
    await redis.set(`history:mines:${userId}:1`, JSON.stringify(result), 'EX', HISTORY_CACHE_TTL);
  }

  return result;
}
