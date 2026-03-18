import { api } from './client';

export interface Card { value: number; suit: string; }

export interface HiLoStartResponse {
  gameId: string;
  currentCard: Card;
  roundNumber: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
}

export interface HiLoGuessResponse {
  correct: boolean;
  nextCard: Card;
  previousCard: Card;
  guess: 'higher' | 'lower';
  roundMultiplier: number;
  totalMultiplier: number;
  currentPayout: number;
  roundNumber: number;
  hiMultiplier?: number;
  loMultiplier?: number;
  hiProbability?: number;
  loProbability?: number;
}

export interface HiLoSkipResponse {
  newCard: Card;
  skipsRemaining: number;
  roundNumber: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
}

export interface HiLoCashoutResponse {
  payout: number;
  multiplier: number;
  profit: number;
  rounds: number;
}

export interface HiLoActiveResponse {
  active: boolean;
  game?: {
    gameId: string;
    status: string;
    betAmount: number;
    currentCard: Card;
    history: { card: Card; guess: string; result: string; roundMultiplier: number }[];
    roundNumber: number;
    currentMultiplier: number;
    currentPayout: number;
    skipsRemaining: number;
    hiMultiplier: number;
    loMultiplier: number;
    hiProbability: number;
    loProbability: number;
  };
}

export async function getActiveHiLoGame() {
  const { data } = await api.get<HiLoActiveResponse>('/games/hilo/active');
  return data;
}

export async function startHiLoGame(betAmount: number) {
  const { data } = await api.post<HiLoStartResponse>('/games/hilo/start', { betAmount });
  return data;
}

export async function guessHiLo(gameId: string, guess: 'higher' | 'lower') {
  const { data } = await api.post<HiLoGuessResponse>('/games/hilo/guess', { gameId, guess });
  return data;
}

export async function skipHiLo(gameId: string) {
  const { data } = await api.post<HiLoSkipResponse>('/games/hilo/skip', { gameId });
  return data;
}

export async function cashoutHiLo(gameId: string) {
  const { data } = await api.post<HiLoCashoutResponse>('/games/hilo/cashout', { gameId });
  return data;
}
