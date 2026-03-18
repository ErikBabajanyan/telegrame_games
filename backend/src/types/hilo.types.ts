export interface Card {
  value: number;    // 1(A) – 13(K)
  suit: string;     // hearts, diamonds, clubs, spades
}

export type HiLoGuess = 'higher' | 'lower';

export interface HiLoRound {
  card: Card;
  guess: HiLoGuess;
  result: 'correct' | 'wrong';
  roundMultiplier: number;
}

export interface HiLoStartResult {
  gameId: string;
  currentCard: Card;
  roundNumber: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
}

export interface HiLoGuessResult {
  correct: boolean;
  nextCard: Card;
  previousCard: Card;
  guess: HiLoGuess;
  roundMultiplier: number;
  totalMultiplier: number;
  currentPayout: number;
  roundNumber: number;
  hiMultiplier?: number;
  loMultiplier?: number;
  hiProbability?: number;
  loProbability?: number;
}

export interface HiLoSkipResult {
  newCard: Card;
  skipsRemaining: number;
  roundNumber: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
}

export interface HiLoCashOutResult {
  payout: number;
  multiplier: number;
  profit: number;
  rounds: number;
}

export interface HiLoActiveState {
  gameId: string;
  status: string;
  betAmount: number;
  currentCard: Card;
  history: HiLoRound[];
  roundNumber: number;
  currentMultiplier: number;
  currentPayout: number;
  skipsRemaining: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
}
