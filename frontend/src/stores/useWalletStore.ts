import { create } from 'zustand';
import { getBalance, verifyDeposit, requestWithdrawal } from '../api/wallet';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletName: string | null;
  available: number;       // nanoTON
  locked: number;
  lifetimeDeposited: number;
  lifetimeWithdrawn: number;
  isLoading: boolean;

  setConnected: (address: string, walletName: string) => void;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  setBalance: (available: number) => void;
  deposit: (txHash: string) => Promise<{ amount: number; newBalance: number }>;
  withdraw: (amount: number, toAddress: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnected: false,
  address: null,
  walletName: null,
  available: 0,
  locked: 0,
  lifetimeDeposited: 0,
  lifetimeWithdrawn: 0,
  isLoading: false,

  setConnected: (address, walletName) => {
    set({ isConnected: true, address, walletName });
  },

  disconnect: () => {
    set({ isConnected: false, address: null, walletName: null });
  },

  refreshBalance: async () => {
    try {
      const data = await getBalance();
      set({
        available: data.available,
        locked: data.locked,
        lifetimeDeposited: data.lifetimeDeposited,
        lifetimeWithdrawn: data.lifetimeWithdrawn,
      });
    } catch {
      // Silently fail — balance will be stale
    }
  },

  setBalance: (available) => {
    set({ available });
  },

  deposit: async (txHash) => {
    set({ isLoading: true });
    try {
      const result = await verifyDeposit(txHash);
      set({ available: result.newBalance, isLoading: false });
      return { amount: result.amount, newBalance: result.newBalance };
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  withdraw: async (amount, toAddress) => {
    set({ isLoading: true });
    try {
      const result = await requestWithdrawal(amount, toAddress);
      // Balance already deducted server-side, refresh to sync
      const balance = await getBalance();
      set({ available: balance.available, locked: balance.locked, isLoading: false });
      return result.requestId;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
