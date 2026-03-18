// ─── Game Constants ───
export const GRID_SIZE = 25;
export const HOUSE_EDGE = 0.02;
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const MAX_PAYOUT_MULTIPLIER = 10_000;
export const MIN_BET = 10_000_000;           // 0.01 TON in nanoTON

// ─── Luck Factor Bounds ───
export const LUCK_DEFAULT = 1.0;
export const LUCK_MIN = 0.7;
export const LUCK_MAX = 1.5;

// ─── Bet Limits by Mine Count (nanoTON) ───
export const BET_LIMITS: { minMines: number; maxBet: number }[] = [
  { minMines: 15, maxBet: 20_000_000_000 },   // 20 TON
  { minMines: 10, maxBet: 50_000_000_000 },    // 50 TON
  { minMines: 5,  maxBet: 100_000_000_000 },   // 100 TON
  { minMines: 1,  maxBet: 500_000_000_000 },   // 500 TON
];

// ─── Wallet Constants ───
export const MIN_DEPOSIT = 100_000_000;          // 0.1 TON
export const MIN_WITHDRAWAL = 500_000_000;       // 0.5 TON
export const WITHDRAWAL_FEE = 100_000_000;       // 0.1 TON
export const REVIEW_THRESHOLD = 100_000_000_000; // 100 TON

// ─── Worker Intervals ───
export const BALANCE_SYNC_INTERVAL = 30_000;        // 30s
export const DEPOSIT_POLL_INTERVAL = 10_000;         // 10s
export const LUCK_RECALC_INTERVAL = 60 * 60 * 1000;  // 1h
export const DEPOSIT_SEEN_TTL = 259_200;              // 72h in seconds
export const ACTIVE_GAME_TTL = 86_400;                // 24h in seconds
export const HISTORY_CACHE_TTL = 30;                   // 30s cache for game history

// ─── Rate Limits ───
export const RATE_LIMIT_BET = { max: 10, windowSeconds: 1 };
export const RATE_LIMIT_WITHDRAWAL = { max: 3, windowSeconds: 3600 };
export const RATE_LIMIT_DEFAULT = { max: 60, windowSeconds: 60 };

// ─── Luck Calculation Tuning ───
export const LUCK_PROFIT_WEIGHT = 0.6;
export const LUCK_WINRATE_THRESHOLD = 0.6;
export const LUCK_WINRATE_WEIGHT = 0.5;
export const LUCK_SMOOTHING = 0.4;
export const LUCK_LOOKBACK_HOURS = 24;
export const LUCK_REALTIME_PROFIT_THRESHOLD = 50_000_000_000; // 50 TON net profit triggers immediate recalc

// ─── HiLo Constants ───
export const HILO_HOUSE_EDGE = 0.025;          // 2.5%
export const HILO_MAX_SKIPS = 3;
export const HILO_CARD_VALUES = 13;             // A(1) through K(13)
export const HILO_SUITS_PER_VALUE = 4;
export const HILO_DECK_SIZE = 52;
export const HILO_MAX_BET = 500_000_000_000;    // 500 TON
export const HILO_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

// ─── Dice Constants ───
export const DICE_HOUSE_EDGE = 0.015;             // 1.5%
export const DICE_MIN_TARGET = 2;
export const DICE_MAX_TARGET = 98;
export const DICE_RANGE = 100;
export const DICE_MAX_BET = 500_000_000_000;       // 500 TON

// ─── Telegram ───
export const TELEGRAM_HMAC_KEY = 'WebAppData';
