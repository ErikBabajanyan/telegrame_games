import { create } from 'zustand';
import { rollDice } from '../api/dice';

const HOUSE_EDGE = 0.015;

interface DiceResult {
  result: number;
  win: boolean;
  payout: number;
  multiplier: number;
  profit: number;
}

interface DiceState {
  status: 'idle' | 'rolling' | 'result';
  betAmount: number;
  target: number;
  mode: 'under' | 'over';
  winProbability: number;
  multiplier: number;
  lastResult: DiceResult | null;
  isLoading: boolean;

  setTarget: (n: number) => void;
  setMode: (m: 'under' | 'over') => void;
  setBetAmount: (n: number) => void;
  setWinChance: (chance: number) => void;
  roll: () => Promise<void>;
  clearResult: () => void;
}

function calcProb(target: number, mode: 'under' | 'over'): number {
  return mode === 'under' ? (target - 1) / 100 : (100 - target) / 100;
}

function calcMult(prob: number): number {
  if (prob <= 0) return 0;
  return Math.floor((1 / prob) * (1 - HOUSE_EDGE) * 100) / 100;
}

export const useDiceStore = create<DiceState>((set, get) => ({
  status: 'idle',
  betAmount: 100_000_000,
  target: 50,
  mode: 'under',
  winProbability: 49,
  multiplier: calcMult(49 / 100),
  lastResult: null,
  isLoading: false,

  setTarget: (n) => {
    const { mode } = get();
    const prob = calcProb(n, mode);
    set({ target: n, winProbability: Math.round(prob * 1000) / 10, multiplier: calcMult(prob) });
  },

  setMode: (m) => {
    const { target } = get();
    const prob = calcProb(target, m);
    set({ mode: m, winProbability: Math.round(prob * 1000) / 10, multiplier: calcMult(prob) });
  },

  setBetAmount: (n) => set({ betAmount: n }),

  setWinChance: (chance) => {
    // Clamp to valid range (1-97%)
    const clamped = Math.min(97, Math.max(1, Math.round(chance * 10) / 10));
    const { mode } = get();
    // Reverse-calculate target from desired win chance
    // under: prob = (target - 1) / 100  →  target = prob * 100 + 1
    // over:  prob = (100 - target) / 100 →  target = 100 - prob * 100
    const prob = clamped / 100;
    let newTarget: number;
    if (mode === 'under') {
      newTarget = Math.round(prob * 100 + 1);
    } else {
      newTarget = Math.round(100 - prob * 100);
    }
    newTarget = Math.min(98, Math.max(2, newTarget));
    const actualProb = calcProb(newTarget, mode);
    set({
      target: newTarget,
      winProbability: Math.round(actualProb * 1000) / 10,
      multiplier: calcMult(actualProb),
    });
  },

  roll: async () => {
    const { betAmount, target, mode } = get();
    set({ isLoading: true, status: 'rolling', lastResult: null });
    try {
      const result = await rollDice(betAmount, target, mode);
      // Wait for animation
      await new Promise((r) => setTimeout(r, 1500));
      set({
        status: 'result',
        lastResult: {
          result: result.result,
          win: result.win,
          payout: result.payout,
          multiplier: result.multiplier,
          profit: result.profit,
        },
        isLoading: false,
      });
      // Auto-clear result after 3s
      setTimeout(() => {
        const current = get();
        if (current.status === 'result') set({ status: 'idle', lastResult: null });
      }, 3000);
    } catch {
      set({ isLoading: false, status: 'idle' });
    }
  },

  clearResult: () => set({ status: 'idle', lastResult: null }),
}));
