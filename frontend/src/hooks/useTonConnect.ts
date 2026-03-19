import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { useWalletStore } from '../stores/useWalletStore';

const ESCROW_CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS as string;

export function useTonConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const friendlyAddress = useTonAddress(true);
  const wallet = useTonWallet();
  const { setConnected, disconnect: storeDisconnect } = useWalletStore();

  const isConnected = !!wallet;
  const address = friendlyAddress || null;
  const walletName = wallet?.device?.appName || null;

  // Sync wallet state to store when connected
  if (isConnected && address && walletName) {
    setConnected(address, walletName);
  }

  const connect = useCallback(async () => {
    await tonConnectUI.openModal();
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    await tonConnectUI.disconnect();
    storeDisconnect();
  }, [tonConnectUI, storeDisconnect]);

  const sendDeposit = useCallback(async (amountNano: number) => {
    if (!ESCROW_CONTRACT_ADDRESS) {
      throw new Error('Escrow contract address is not configured');
    }

    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [{
        address: ESCROW_CONTRACT_ADDRESS,
        amount: amountNano.toString(),
      }],
    });

    // The boc (bag of cells) serves as the transaction identifier
    return result.boc;
  }, [tonConnectUI]);

  return {
    isConnected,
    address,
    walletName,
    connect,
    disconnect,
    sendDeposit,
  };
}
