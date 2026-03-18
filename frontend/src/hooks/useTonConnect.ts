import { useCallback } from 'react';
import { useWalletStore } from '../stores/useWalletStore';

/**
 * TON Connect hook.
 * In production, this wraps @tonconnect/ui-react's useTonConnectUI().
 * For dev/testing, provides mock connect/disconnect.
 */
export function useTonConnect() {
  const { isConnected, address, walletName, setConnected, disconnect } = useWalletStore();

  const connect = useCallback(async () => {
    // TODO: Replace with real TON Connect UI
    // const tonConnectUI = new TonConnectUI({
    //   manifestUrl: 'https://toncasino.app/tonconnect-manifest.json',
    // });
    // const wallet = await tonConnectUI.connectWallet();

    // Dev stub: simulate connection
    const mockAddress = 'EQA' + Math.random().toString(36).slice(2, 10) + '...xyz';
    setConnected(mockAddress, 'Tonkeeper');
  }, [setConnected]);

  const sendDeposit = useCallback(async (amountNano: number) => {
    // TODO: Replace with real TON Connect sendTransaction
    // await tonConnectUI.sendTransaction({
    //   validUntil: Math.floor(Date.now() / 1000) + 600,
    //   messages: [{
    //     address: ESCROW_CONTRACT_ADDRESS,
    //     amount: amountNano.toString(),
    //     payload: buildDepositPayload(userId),
    //   }],
    // });

    // Dev stub: return mock tx hash
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  return {
    isConnected,
    address,
    walletName,
    connect,
    disconnect,
    sendDeposit,
  };
}
