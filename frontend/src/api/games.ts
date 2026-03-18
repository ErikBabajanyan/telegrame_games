import { api } from './client';

export interface StartGameResponse {
  gameId: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RevealResponse {
  result: 'gem' | 'mine';
  cellIndex: number;
  currentMultiplier: number;
  currentPayout: number;
  nextSafeProbability?: number;
  revealedCount: number;
  autoCashout?: boolean;
  minePositions?: number[];
  serverSeed?: string;
}

export interface CashoutResponse {
  payout: number;
  multiplier: number;
  profit: number;
  serverSeed: string;
  minePositions: number[];
}

export interface VerifyResponse {
  valid: boolean;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  minePositions: number[];
  computedPositions: number[];
  hashMatch: boolean;
}

export interface GameHistoryItem {
  gameId: string;
  gameType: string;
  status: string;
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  mineCount: number;
  revealedCount: number;
  serverSeedHash: string;
  createdAt: string;
  endedAt: string | null;
}

export interface ActiveGameResponse {
  active: boolean;
  game?: {
    gameId: string;
    status: string;
    betAmount: number;
    mineCount: number;
    revealedCells: number[];
    revealedCount: number;
    currentMultiplier: number;
    currentPayout: number;
    cells: { index: number; status: 'hidden' | 'gem' }[];
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

export async function getActiveGame() {
  const { data } = await api.get<ActiveGameResponse>('/games/mines/active');
  return data;
}

export async function startMinesGame(betAmount: number, mineCount: number) {
  const { data } = await api.post<StartGameResponse>('/games/mines/start', { betAmount, mineCount });
  return data;
}

export async function revealCell(gameId: string, cellIndex: number) {
  const { data } = await api.post<RevealResponse>('/games/mines/reveal', { gameId, cellIndex });
  return data;
}

export async function cashoutGame(gameId: string) {
  const { data } = await api.post<CashoutResponse>('/games/mines/cashout', { gameId });
  return data;
}

export async function verifyGame(gameId: string) {
  const { data } = await api.get<VerifyResponse>(`/games/mines/verify/${gameId}`);
  return data;
}

export async function getGameHistory(page = 1, limit = 20) {
  const { data } = await api.get<{
    games: GameHistoryItem[];
    total: number;
    page: number;
    totalPages: number;
  }>('/games/mines/history', { params: { page, limit } });
  return data;
}
