import { api } from './client';

export interface BalanceResponse {
  available: number;
  locked: number;
  lifetimeDeposited: number;
  lifetimeWithdrawn: number;
}

export interface DepositVerifyResponse {
  alreadyProcessed: boolean;
  amount: number;
  newBalance: number;
}

export interface WithdrawResponse {
  requestId: string;
  amount: number;
  fee: number;
  status: string;
  reviewRequired: boolean;
}

export interface TransactionItem {
  _id: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  txHash: string | null;
  status: string;
  createdAt: string;
}

export async function getBalance() {
  const { data } = await api.get<BalanceResponse>('/wallet/balance');
  return data;
}

export async function verifyDeposit(txHash: string) {
  const { data } = await api.post<DepositVerifyResponse>('/wallet/deposit/verify', { txHash });
  return data;
}

export async function requestWithdrawal(amount: number, toAddress: string) {
  const { data } = await api.post<WithdrawResponse>('/wallet/withdraw', { amount, toAddress });
  return data;
}

export async function getTransactions(page = 1, limit = 20, type?: string) {
  const { data } = await api.get<{
    transactions: TransactionItem[];
    total: number;
    page: number;
    totalPages: number;
  }>('/wallet/transactions', { params: { page, limit, type } });
  return data;
}
