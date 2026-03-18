import { create } from 'zustand';
import {
  startHiLoGame, guessHiLo, skipHiLo, cashoutHiLo, getActiveHiLoGame,
  type Card,
} from '../api/hilo';

interface HiLoRound {
  card: Card;
  guess: string;
  result: string;
  roundMultiplier: number;
}

interface HiLoState {
  gameId: string | null;
  status: 'idle' | 'active' | 'revealing' | 'won' | 'lost';
  betAmount: number;
  currentCard: Card | null;
  history: HiLoRound[];
  roundNumber: number;
  currentMultiplier: number;
  currentPayout: number;
  skipsRemaining: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
  lastResult: { correct: boolean; card: Card } | null;
  isLoading: boolean;

  setBetAmount: (amount: number) => void;
  checkActiveGame: () => Promise<void>;
  startGame: () => Promise<void>;
  guessHigher: () => Promise<void>;
  guessLower: () => Promise<void>;
  skip: () => Promise<void>;
  cashOut: () => Promise<void>;
  reset: () => void;
}

export const useHiLoStore = create<HiLoState>((set, get) => ({
  gameId: null,
  status: 'idle',
  betAmount: 100_000_000,
  currentCard: null,
  history: [],
  roundNumber: 0,
  currentMultiplier: 1,
  currentPayout: 0,
  skipsRemaining: 3,
  hiMultiplier: 0,
  loMultiplier: 0,
  hiProbability: 0,
  loProbability: 0,
  lastResult: null,
  isLoading: false,

  setBetAmount: (amount) => set({ betAmount: amount }),

  checkActiveGame: async () => {
    try {
      const data = await getActiveHiLoGame();
      if (data.active && data.game) {
        const g = data.game;
        set({
          gameId: g.gameId,
          status: 'active',
          betAmount: g.betAmount,
          currentCard: g.currentCard,
          history: g.history,
          roundNumber: g.roundNumber,
          currentMultiplier: g.currentMultiplier,
          currentPayout: g.currentPayout,
          skipsRemaining: g.skipsRemaining,
          hiMultiplier: g.hiMultiplier,
          loMultiplier: g.loMultiplier,
          hiProbability: g.hiProbability,
          loProbability: g.loProbability,
          lastResult: null,
          isLoading: false,
        });
      }
    } catch { /* no active game */ }
  },

  startGame: async () => {
    const { betAmount } = get();
    set({ isLoading: true });
    try {
      const result = await startHiLoGame(betAmount);
      set({
        gameId: result.gameId,
        status: 'active',
        currentCard: result.currentCard,
        history: [],
        roundNumber: result.roundNumber,
        currentMultiplier: 1,
        currentPayout: 0,
        skipsRemaining: 3,
        hiMultiplier: result.hiMultiplier,
        loMultiplier: result.loMultiplier,
        hiProbability: result.hiProbability,
        loProbability: result.loProbability,
        lastResult: null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  guessHigher: async () => {
    const { gameId } = get();
    if (!gameId) return;
    set({ isLoading: true, status: 'revealing' });
    try {
      const result = await guessHiLo(gameId, 'higher');
      set({ lastResult: { correct: result.correct, card: result.nextCard } });

      // Short delay for card flip animation
      await new Promise((r) => setTimeout(r, 500));

      if (result.correct) {
        set({
          status: 'active',
          currentCard: result.nextCard,
          roundNumber: result.roundNumber,
          currentMultiplier: result.totalMultiplier,
          currentPayout: result.currentPayout,
          hiMultiplier: result.hiMultiplier ?? 0,
          loMultiplier: result.loMultiplier ?? 0,
          hiProbability: result.hiProbability ?? 0,
          loProbability: result.loProbability ?? 0,
          history: [...get().history, { card: result.previousCard, guess: 'higher', result: 'correct', roundMultiplier: result.roundMultiplier }],
          isLoading: false,
        });
      } else {
        set({
          status: 'lost',
          currentCard: result.nextCard,
          history: [...get().history, { card: result.previousCard, guess: 'higher', result: 'wrong', roundMultiplier: result.roundMultiplier }],
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, status: 'active' });
    }
  },

  guessLower: async () => {
    const { gameId } = get();
    if (!gameId) return;
    set({ isLoading: true, status: 'revealing' });
    try {
      const result = await guessHiLo(gameId, 'lower');
      set({ lastResult: { correct: result.correct, card: result.nextCard } });

      await new Promise((r) => setTimeout(r, 500));

      if (result.correct) {
        set({
          status: 'active',
          currentCard: result.nextCard,
          roundNumber: result.roundNumber,
          currentMultiplier: result.totalMultiplier,
          currentPayout: result.currentPayout,
          hiMultiplier: result.hiMultiplier ?? 0,
          loMultiplier: result.loMultiplier ?? 0,
          hiProbability: result.hiProbability ?? 0,
          loProbability: result.loProbability ?? 0,
          history: [...get().history, { card: result.previousCard, guess: 'lower', result: 'correct', roundMultiplier: result.roundMultiplier }],
          isLoading: false,
        });
      } else {
        set({
          status: 'lost',
          currentCard: result.nextCard,
          history: [...get().history, { card: result.previousCard, guess: 'lower', result: 'wrong', roundMultiplier: result.roundMultiplier }],
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, status: 'active' });
    }
  },

  skip: async () => {
    const { gameId } = get();
    if (!gameId) return;
    set({ isLoading: true });
    try {
      const result = await skipHiLo(gameId);
      set({
        currentCard: result.newCard,
        skipsRemaining: result.skipsRemaining,
        roundNumber: result.roundNumber,
        hiMultiplier: result.hiMultiplier,
        loMultiplier: result.loMultiplier,
        hiProbability: result.hiProbability,
        loProbability: result.loProbability,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  cashOut: async () => {
    const { gameId } = get();
    if (!gameId) return;
    set({ isLoading: true });
    try {
      const result = await cashoutHiLo(gameId);
      set({
        status: 'won',
        currentMultiplier: result.multiplier,
        currentPayout: result.payout,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  reset: () => set({
    gameId: null, status: 'idle', currentCard: null, history: [],
    roundNumber: 0, currentMultiplier: 1, currentPayout: 0,
    skipsRemaining: 3, hiMultiplier: 0, loMultiplier: 0,
    hiProbability: 0, loProbability: 0, lastResult: null, isLoading: false,
  }),
}));
