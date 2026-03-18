import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';
import type { DepositVerification, WithdrawalResult } from '../../types/wallet.types.js';

export async function verifyDepositTransaction(txHash: string): Promise<DepositVerification> {
  logger.debug({ txHash }, 'Verifying deposit transaction on-chain');

  if (config.NODE_ENV === 'development') {
    logger.warn('Using stubbed TON deposit verification (development mode)');
    return { valid: true, amount: 1_000_000_000, fromAddress: 'EQStubAddress', userId: null };
  }

  try {
    const response = await fetch(
      `https://toncenter.com/api/v2/getTransactions?hash=${txHash}`,
      { headers: config.TON_API_KEY ? { 'X-API-Key': config.TON_API_KEY } : {} },
    );
    if (!response.ok) return { valid: false, amount: 0, fromAddress: '', userId: null };

    const data = (await response.json()) as { result?: Array<{ in_msg?: { destination?: string; value?: string; source?: string } }> };
    const tx = data?.result?.[0];
    if (!tx) return { valid: false, amount: 0, fromAddress: '', userId: null };

    if (tx.in_msg?.destination !== config.ESCROW_CONTRACT_ADDRESS) {
      return { valid: false, amount: 0, fromAddress: '', userId: null };
    }

    return {
      valid: true,
      amount: Number(tx.in_msg?.value ?? 0),
      fromAddress: tx.in_msg?.source ?? '',
      userId: null,
    };
  } catch (error) {
    logger.error(error, 'Failed to verify deposit on-chain');
    return { valid: false, amount: 0, fromAddress: '', userId: null };
  }
}

export async function sendWithdrawal(toAddress: string, amountNano: number): Promise<WithdrawalResult> {
  logger.info({ toAddress, amountNano }, 'Sending withdrawal transaction');

  if (config.NODE_ENV === 'development') {
    logger.warn('Using stubbed TON withdrawal (development mode)');
    return { success: true, txHash: `dev_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` };
  }

  try {
    return { success: false, txHash: null };
  } catch (error) {
    logger.error(error, 'Failed to send withdrawal transaction');
    return { success: false, txHash: null };
  }
}

export async function getEscrowBalance(): Promise<number> {
  if (config.NODE_ENV === 'development') return 999_000_000_000;

  try {
    const response = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${config.ESCROW_CONTRACT_ADDRESS}`,
      { headers: config.TON_API_KEY ? { 'X-API-Key': config.TON_API_KEY } : {} },
    );
    const data = (await response.json()) as { result?: string };
    return Number(data?.result ?? 0);
  } catch (error) {
    logger.error(error, 'Failed to get escrow balance');
    return 0;
  }
}
