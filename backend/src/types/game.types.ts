export interface StartGameInput {
  userId: string;
  betAmount: number;   // nanoTON
  mineCount: number;
}

export interface RevealCellInput {
  userId: string;
  gameId: string;
  cellIndex: number;
}

export interface StartGameResult {
  gameId: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RevealResult {
  result: 'gem' | 'mine';
  cellIndex: number;
  currentMultiplier: number;
  currentPayout: number;
  revealedCount: number;
  autoCashout?: boolean;
  minePositions?: number[];
}

export interface CashOutResult {
  payout: number;
  multiplier: number;
  profit: number;
  minePositions: number[];
}

export interface ActiveGameState {
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
}

export interface GameHistoryItem {
  gameId: string;
  gameType: string;
  status: string;
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  mineCount?: number;
  revealedCount: number;
  createdAt: Date;
  endedAt: Date | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
