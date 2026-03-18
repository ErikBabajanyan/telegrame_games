import { randomInt } from 'crypto';
import {
  HILO_HOUSE_EDGE, HILO_CARD_VALUES, HILO_SUITS_PER_VALUE,
  HILO_SUITS, LUCK_DEFAULT,
} from '../../../types/constants.js';
import type { Card, HiLoGuess } from '../../../types/hilo.types.js';

// ─── Card Helpers ───

export function cardName(value: number): string {
  if (value === 1) return 'A';
  if (value === 11) return 'J';
  if (value === 12) return 'Q';
  if (value === 13) return 'K';
  return String(value);
}

export function randomCard(): Card {
  const value = randomInt(1, HILO_CARD_VALUES + 1);
  const suit = HILO_SUITS[randomInt(0, HILO_SUITS.length)];
  return { value, suit };
}

export function generateCardForResult(
  currentValue: number,
  guess: HiLoGuess,
  isCorrect: boolean,
): Card {
  const suit = HILO_SUITS[randomInt(0, HILO_SUITS.length)];

  if (isCorrect) {
    // Generate a card that satisfies the guess
    if (guess === 'higher') {
      if (currentValue >= HILO_CARD_VALUES) {
        // Edge case: current is K, no higher exists — loss forced
        return { value: currentValue, suit }; // equal = loss
      }
      const value = randomInt(currentValue + 1, HILO_CARD_VALUES + 1);
      return { value, suit };
    } else {
      if (currentValue <= 1) {
        return { value: currentValue, suit };
      }
      const value = randomInt(1, currentValue);
      return { value, suit };
    }
  } else {
    // Generate a card that fails the guess (opposite or equal)
    if (guess === 'higher') {
      // Lower or equal
      const value = randomInt(1, currentValue + 1);
      return { value, suit };
    } else {
      // Higher or equal
      const value = randomInt(currentValue, HILO_CARD_VALUES + 1);
      return { value, suit };
    }
  }
}

// ─── Probability ───

export function calculateProbabilities(currentValue: number): {
  hiProbability: number;
  loProbability: number;
  equalProbability: number;
} {
  const totalCards = HILO_CARD_VALUES * HILO_SUITS_PER_VALUE; // 52
  const equalCards = HILO_SUITS_PER_VALUE; // 4
  const eligible = totalCards - equalCards; // 48 (excluding equal-value cards)

  const cardsAbove = (HILO_CARD_VALUES - currentValue) * HILO_SUITS_PER_VALUE;
  const cardsBelow = (currentValue - 1) * HILO_SUITS_PER_VALUE;

  return {
    hiProbability: eligible > 0 ? cardsAbove / eligible : 0,
    loProbability: eligible > 0 ? cardsBelow / eligible : 0,
    equalProbability: totalCards > 0 ? equalCards / totalCards : 0,
  };
}

/** Multiplier for a guess based on its win probability */
export function guessMultiplier(winProbability: number): number {
  if (winProbability <= 0) return 0;
  return (1 / winProbability) * (1 - HILO_HOUSE_EDGE);
}

/** Get multipliers for both directions */
export function getMultipliers(currentValue: number): {
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
} {
  const probs = calculateProbabilities(currentValue);
  return {
    hiMultiplier: probs.hiProbability > 0 ? Math.floor(guessMultiplier(probs.hiProbability) * 100) / 100 : 0,
    loMultiplier: probs.loProbability > 0 ? Math.floor(guessMultiplier(probs.loProbability) * 100) / 100 : 0,
    hiProbability: Math.round(probs.hiProbability * 1000) / 10, // e.g. 61.7
    loProbability: Math.round(probs.loProbability * 1000) / 10,
  };
}

// ─── Per-Round RNG ───

export function rollGuess(
  currentValue: number,
  guess: HiLoGuess,
  luckFactor: number = LUCK_DEFAULT,
): { isCorrect: boolean; card: Card } {
  const probs = calculateProbabilities(currentValue);
  const baseWinProb = guess === 'higher' ? probs.hiProbability : probs.loProbability;

  // No valid guess (e.g. guessing higher on King)
  if (baseWinProb <= 0) {
    const card = generateCardForResult(currentValue, guess, false);
    return { isCorrect: false, card };
  }

  // Adjust with luck factor (higher factor = harder to win)
  const adjustedProb = Math.min(0.98, Math.max(0.02, baseWinProb / luckFactor));

  // Roll
  const roll = randomInt(0, 1_000_000) / 1_000_000;
  const isCorrect = roll < adjustedProb;

  const card = generateCardForResult(currentValue, guess, isCorrect);
  return { isCorrect, card };
}
