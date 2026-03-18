import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { redis, CREDIT_BALANCE_SCRIPT } from '../infrastructure/redis.js';
import { Balance } from '../modules/wallet/balance.model.js';
import { Transaction } from '../modules/wallet/transaction.model.js';
import { User } from '../modules/users/user.model.js';
import { publishEvent } from '../infrastructure/websocket.js';
import { DEPOSIT_POLL_INTERVAL, DEPOSIT_SEEN_TTL } from '../types/constants.js';

let isRunning = false;

export async function startDepositListener(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  logger.info('✅ Deposit listener started');

  while (isRunning) {
    try {
      await checkForDeposits();
    } catch (error) {
      logger.error(error, 'Deposit listener error');
    }
    await sleep(DEPOSIT_POLL_INTERVAL);
  }
}

export function stopDepositListener(): void {
  isRunning = false;
  logger.info('Deposit listener stopped');
}

async function checkForDeposits(): Promise<void> {
  if (config.NODE_ENV === 'development') return;

  try {
    const response = await fetch(
      `https://toncenter.com/api/v2/getTransactions?address=${config.ESCROW_CONTRACT_ADDRESS}&limit=20`,
      { headers: config.TON_API_KEY ? { 'X-API-Key': config.TON_API_KEY } : {} },
    );
    if (!response.ok) return;

    const data = (await response.json()) as { result?: Array<Record<string, unknown>> };
    const transactions = data?.result ?? [];

    for (const tx of transactions) {
      const txId = tx.transaction_id as { hash?: string } | undefined;
      const txHash = txId?.hash;
      if (!txHash) continue;

      const seen = await redis.get(`deposit:seen:${txHash}`);
      if (seen) continue;

      const inMsg = tx.in_msg as { source?: string; value?: string } | undefined;
      if (!inMsg?.source || !inMsg?.value) continue;

      const amount = Number(inMsg.value);
      if (amount <= 0) continue;

      const fromAddress = inMsg.source;
      const user = await User.findOne({ tonAddress: fromAddress });
      if (!user) continue;

      await redis.set(`deposit:seen:${txHash}`, '1', 'EX', DEPOSIT_SEEN_TTL);

      const userId = user._id.toString();
      const newBalance = await redis.eval(CREDIT_BALANCE_SCRIPT, 1, `balance:${userId}`, amount.toString()) as number;

      await Transaction.create({
        userId, type: 'deposit', amount,
        balanceBefore: newBalance - amount, balanceAfter: newBalance,
        txHash, status: 'confirmed',
      });

      await Balance.updateOne({ userId }, { available: newBalance, $inc: { lifetimeDeposited: amount } });

      await publishEvent(userId, 'wallet:deposit_confirmed', { txHash, amount, newBalance });
      await publishEvent(userId, 'wallet:balance', { available: newBalance });

      logger.info({ userId, txHash, amount }, 'Auto-detected deposit credited');
    }
  } catch (error) {
    logger.error(error, 'Failed to poll for deposits');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
