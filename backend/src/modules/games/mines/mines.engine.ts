import { createHash, randomBytes, randomInt } from 'crypto';
import {
  GRID_SIZE, HOUSE_EDGE, MIN_MINES, MAX_MINES,
  MAX_PAYOUT_MULTIPLIER, LUCK_DEFAULT, BET_LIMITS, MIN_BET,
} from '../../../types/constants.js';

export { MIN_BET, LUCK_DEFAULT };

export function isValidMineCount(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_MINES && n <= MAX_MINES;
}

// ─── Seed Generation (cosmetic) ───

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashServerSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

// ─── Per-Reveal RNG ───

export function rollMine(
  mineCount: number,
  revealedSafeCount: number,
  luckFactor: number = LUCK_DEFAULT,
): boolean {
  const cellsRemaining = GRID_SIZE - revealedSafeCount;
  if (cellsRemaining <= 0) return false;
  if (mineCount >= cellsRemaining) return true;

  const baseProbability = mineCount / cellsRemaining;
  const adjustedProbability = Math.min(0.95, Math.max(0.01, baseProbability * luckFactor));
  const roll = randomInt(0, 1_000_000) / 1_000_000;

  return roll < adjustedProbability;
}

export function generateRemainingMinePositions(
  hitCellIndex: number,
  revealedSafeCells: number[],
  mineCount: number,
): number[] {
  const minePositions = [hitCellIndex];
  const allRevealed = new Set([...revealedSafeCells, hitCellIndex]);
  const unrevealed = Array.from({ length: GRID_SIZE }, (_, i) => i)
    .filter((i) => !allRevealed.has(i));

  const shuffled = [...unrevealed].sort(() => Math.random() - 0.5);
  minePositions.push(...shuffled.slice(0, mineCount - 1));

  return minePositions.sort((a, b) => a - b);
}

// ─── Mathematical Model ───

function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function appliedMultiplier(revealedCount: number, mineCount: number): number {
  if (revealedCount === 0) return 1;
  const fair = combinations(GRID_SIZE, revealedCount) /
    combinations(GRID_SIZE - mineCount, revealedCount);
  return Math.min(fair * (1 - HOUSE_EDGE), MAX_PAYOUT_MULTIPLIER);
}

export function calculatePayout(betAmountNano: number, revealedCount: number, mineCount: number): number {
  return Math.floor(betAmountNano * appliedMultiplier(revealedCount, mineCount));
}

export function maxReveals(mineCount: number): number {
  return GRID_SIZE - mineCount;
}

export function getMaxBet(mineCount: number): number {
  for (const tier of BET_LIMITS) {
    if (mineCount >= tier.minMines) return tier.maxBet;
  }
  return BET_LIMITS[BET_LIMITS.length - 1].maxBet;
}
