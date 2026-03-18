import { Balance } from './balance.model.js';
import { Transaction } from './transaction.model.js';
import { WithdrawalRequest } from './withdrawal.model.js';
import { redis, CREDIT_BALANCE_SCRIPT } from '../../infrastructure/redis.js';
import { publishEvent } from '../../infrastructure/websocket.js';
import { safeMongoWrite } from '../../infrastructure/mongo-retry.js';
import { verifyDepositTransaction } from './ton.bridge.js';
import { enqueueWithdrawal } from './withdrawal.queue.js';
import { logger } from '../../utils/logger.js';
import { MIN_DEPOSIT, MIN_WITHDRAWAL, WITHDRAWAL_FEE, REVIEW_THRESHOLD, DEPOSIT_SEEN_TTL } from '../../types/constants.js';
import type { BalanceInfo, TransactionFilter } from '../../types/wallet.types.js';
import { BadRequestError } from '../../types/errors.js';

// ─── Get Balance ───

export async function getBalance(userId: string): Promise<BalanceInfo> {
  const cachedBalance = await redis.get(`balance:${userId}`);

  if (cachedBalance !== null) {
    const balance = await Balance.findOne({ userId }).lean();
    return {
      available: Number(cachedBalance),
      locked: balance?.locked ?? 0,
      lifetimeDeposited: balance?.lifetimeDeposited ?? 0,
      lifetimeWithdrawn: balance?.lifetimeWithdrawn ?? 0,
    };
  }

  const balance = await Balance.findOne({ userId });
  if (!balance) return { available: 0, locked: 0, lifetimeDeposited: 0, lifetimeWithdrawn: 0 };

  await redis.set(`balance:${userId}`, balance.available.toString());
  return {
    available: balance.available,
    locked: balance.locked,
    lifetimeDeposited: balance.lifetimeDeposited,
    lifetimeWithdrawn: balance.lifetimeWithdrawn,
  };
}

// ─── Verify Deposit ───

export async function verifyDeposit(userId: string, txHash: string) {
  const seen = await redis.get(`deposit:seen:${txHash}`);
  if (seen) {
    const existingTx = await Transaction.findOne({ txHash, type: 'deposit' }).lean();
    if (existingTx) {
      return { alreadyProcessed: true, amount: existingTx.amount, newBalance: existingTx.balanceAfter };
    }
  }

  const verification = await verifyDepositTransaction(txHash);
  if (!verification.valid) throw new BadRequestError('Invalid or unconfirmed transaction');
  if (verification.amount < MIN_DEPOSIT) throw new BadRequestError('Minimum deposit is 0.1 TON');

  await redis.set(`deposit:seen:${txHash}`, '1', 'EX', DEPOSIT_SEEN_TTL);

  const depositAmount = verification.amount;
  const newBalance = await redis.eval(CREDIT_BALANCE_SCRIPT, 1, `balance:${userId}`, depositAmount.toString()) as number;

  await Transaction.create({
    userId, type: 'deposit', amount: depositAmount,
    balanceBefore: newBalance - depositAmount, balanceAfter: newBalance,
    txHash, status: 'confirmed',
  });

  await Balance.updateOne({ userId }, { available: newBalance, $inc: { lifetimeDeposited: depositAmount } });

  if (verification.fromAddress) {
    const { User } = await import('../users/user.model.js');
    await User.updateOne({ _id: userId }, { tonAddress: verification.fromAddress });
  }

  await publishEvent(userId, 'wallet:deposit_confirmed', { txHash, amount: depositAmount, newBalance });
  await publishEvent(userId, 'wallet:balance', { available: newBalance });

  logger.info({ userId, txHash, amount: depositAmount }, 'Deposit verified');
  return { alreadyProcessed: false, amount: depositAmount, newBalance };
}

// ─── Request Withdrawal ───

export async function requestWithdrawal(userId: string, amount: number, toAddress: string) {
  if (amount < MIN_WITHDRAWAL) throw new BadRequestError('Minimum withdrawal is 0.5 TON');

  const totalDeduction = amount + WITHDRAWAL_FEE;
  const currentBalance = await redis.get(`balance:${userId}`);
  if (!currentBalance || Number(currentBalance) < totalDeduction) {
    throw new BadRequestError('Insufficient balance (amount + 0.1 TON fee)');
  }

  const DEDUCT_SCRIPT = `
    local balance = tonumber(redis.call('GET', KEYS[1]))
    local deduction = tonumber(ARGV[1])
    if not balance or balance < deduction then return -1 end
    redis.call('DECRBY', KEYS[1], deduction)
    return balance - deduction
  `;
  const newBalance = await redis.eval(DEDUCT_SCRIPT, 1, `balance:${userId}`, totalDeduction.toString()) as number;
  if (newBalance === -1) throw new BadRequestError('Insufficient balance');

  const reviewRequired = amount >= REVIEW_THRESHOLD;
  const request = await WithdrawalRequest.create({
    userId, toAddress, amount, fee: WITHDRAWAL_FEE,
    status: reviewRequired ? 'pending' : 'processing', reviewRequired,
  });

  await Transaction.create({
    userId, type: 'withdrawal', amount: totalDeduction,
    balanceBefore: newBalance + totalDeduction, balanceAfter: newBalance, status: 'pending',
  });

  safeMongoWrite(
    'balances',
    'updateOne',
    { userId },
    { $set: { available: newBalance }, $inc: { lifetimeWithdrawn: amount } },
    `withdrawal balance sync for ${userId}`,
  );

  if (!reviewRequired) {
    await enqueueWithdrawal({
      requestId: request._id.toString(), userId, toAddress,
      amount, fee: WITHDRAWAL_FEE, reviewRequired: false,
    });
  }

  await publishEvent(userId, 'wallet:balance', { available: newBalance });
  await publishEvent(userId, 'withdrawal:status', { requestId: request._id.toString(), status: request.status });

  logger.info({ userId, amount, toAddress, reviewRequired }, 'Withdrawal requested');
  return { requestId: request._id.toString(), amount, fee: WITHDRAWAL_FEE, status: request.status, reviewRequired };
}

// ─── Transaction History ───

export async function getTransactions(userId: string, page: number = 1, limit: number = 20, type?: string) {
  const skip = (page - 1) * limit;
  const filter: TransactionFilter = { userId };
  if (type) filter.type = type;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);

  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
}
