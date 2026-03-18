import { api } from './client';

export interface DiceRollResponse {
  gameId: string;
  result: number;
  target: number;
  mode: 'under' | 'over';
  win: boolean;
  winProbability: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  profit: number;
}

export async function rollDice(betAmount: number, target: number, mode: 'under' | 'over') {
  const { data } = await api.post<DiceRollResponse>('/games/dice/roll', { betAmount, target, mode });
  return data;
}

export async function getDiceHistory(page = 1, limit = 20) {
  const { data } = await api.get<{
    games: {
      gameId: string;
      status: string;
      betAmount: number;
      payoutAmount: number;
      multiplier: number;
      target: number;
      mode: string;
      result: number;
      createdAt: string;
    }[];
    total: number;
    page: number;
    totalPages: number;
  }>('/games/dice/history', { params: { page, limit } });
  return data;
}
