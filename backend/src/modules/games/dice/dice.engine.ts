import { randomInt } from 'crypto';
import {
  DICE_HOUSE_EDGE, DICE_RANGE, DICE_MIN_TARGET, DICE_MAX_TARGET,
  LUCK_DEFAULT,
} from '../../../types/constants.js';
import type { DiceMode } from '../../../types/dice.types.js';

/** Calculate win probability for a given target and mode */
export function winProbability(target: number, mode: DiceMode): number {
  if (mode === 'under') return (target - 1) / DICE_RANGE;
  return (DICE_RANGE - target) / DICE_RANGE;
}

/** Calculate multiplier from win probability */
export function diceMultiplier(probability: number): number {
  if (probability <= 0) return 0;
  return Math.floor((1 / probability) * (1 - DICE_HOUSE_EDGE) * 100) / 100;
}

/** Get multiplier for a target + mode */
export function getMultiplier(target: number, mode: DiceMode): number {
  return diceMultiplier(winProbability(target, mode));
}

/** Validate target range */
export function isValidTarget(target: number): boolean {
  return Number.isInteger(target) && target >= DICE_MIN_TARGET && target <= DICE_MAX_TARGET;
}

/**
 * Generate a result number consistent with the outcome.
 * Under: win = [1, target-1], loss = [target, 100]
 * Over:  win = [target+1, 100], loss = [1, target]
 */
export function generateResult(target: number, mode: DiceMode, isWin: boolean): number {
  if (mode === 'under') {
    if (isWin) {
      return target <= 2 ? 1 : randomInt(1, target);
    }
    return target >= 100 ? 100 : randomInt(target, 101);
  }
  // over
  if (isWin) {
    return target >= 99 ? 100 : randomInt(target + 1, 101);
  }
  return target <= 1 ? 1 : randomInt(1, target + 1);
}

/**
 * Roll dice with luck factor.
 * Returns the outcome (win/loss) and a display result number.
 */
export function rollDice(
  target: number,
  mode: DiceMode,
  luckFactor: number = LUCK_DEFAULT,
): { result: number; win: boolean } {
  const baseProb = winProbability(target, mode);
  if (baseProb <= 0) return { result: target, win: false };

  const adjustedProb = Math.min(0.99, Math.max(0.01, baseProb / luckFactor));
  const roll = randomInt(0, 1_000_000) / 1_000_000;
  const isWin = roll < adjustedProb;

  const result = generateResult(target, mode, isWin);
  return { result, win: isWin };
}
