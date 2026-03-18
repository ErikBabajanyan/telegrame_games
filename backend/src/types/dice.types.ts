export type DiceMode = 'under' | 'over';

export interface DiceRollInput {
  userId: string;
  betAmount: number;
  target: number;
  mode: DiceMode;
}

export interface DiceRollResult {
  gameId: string;
  result: number;
  target: number;
  mode: DiceMode;
  win: boolean;
  winProbability: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  profit: number;
}
