export interface DepositVerification {
  valid: boolean;
  amount: number;
  fromAddress: string;
  userId: string | null;
}

export interface WithdrawalJobData {
  requestId: string;
  userId: string;
  toAddress: string;
  amount: number;       // nanoTON (net after fee)
  fee: number;          // nanoTON
  reviewRequired: boolean;
}

export interface WithdrawalResult {
  success: boolean;
  txHash: string | null;
}

export interface BalanceInfo {
  available: number;
  locked: number;
  lifetimeDeposited: number;
  lifetimeWithdrawn: number;
}

export interface TransactionFilter {
  userId: string;
  type?: string;
}

export interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}
