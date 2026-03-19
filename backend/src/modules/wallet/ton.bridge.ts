import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';
import type { DepositVerification, WithdrawalResult } from '../../types/wallet.types.js';

export async function verifyDepositTransaction(txHash: string): Promise<DepositVerification> {
  logger.debug({ txHash }, 'Verifying deposit transaction on-chain');

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

  try {
    // TODO: Implement real TON withdrawal using your wallet's secret key
    // This requires @ton/ton or similar SDK to sign and send the transaction
    // from your escrow wallet to the user's address.
    //
    // Example with @ton/ton:
    // const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey: config.TON_API_KEY });
    // const wallet = WalletContractV4.create({ publicKey: ... });
    // const transfer = wallet.createTransfer({ ... });
    // await client.sendExternalMessage(wallet, transfer);
    // return { success: true, txHash: '...' };

    logger.error('sendWithdrawal not yet implemented — requires escrow wallet signing key');
    return { success: false, txHash: null };
  } catch (error) {
    logger.error(error, 'Failed to send withdrawal transaction');
    return { success: false, txHash: null };
  }
}

export async function getEscrowBalance(): Promise<number> {
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
