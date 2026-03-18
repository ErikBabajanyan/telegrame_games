import { useCallback } from 'react';
import { useMinesStore } from '../stores/useMinesStore';
import { useWalletStore } from '../stores/useWalletStore';
import { hapticLight, hapticHeavy, hapticSuccess, hapticError } from '../utils/haptics';

/**
 * High-level hook that combines mines store actions with side effects
 * (haptics, balance refresh, confetti).
 */
export function useMinesGame() {
  const store = useMinesStore();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  const handleStartGame = useCallback(async () => {
    try {
      await store.startGame();
      hapticLight();
    } catch (error: any) {
      hapticError();
      throw error;
    }
  }, [store.startGame]);

  const handleRevealCell = useCallback(async (index: number) => {
    const prevStatus = store.status;
    await store.revealCell(index);

    // Check result after reveal
    const newStatus = useMinesStore.getState().status;
    const cells = useMinesStore.getState().cells;

    if (cells[index]?.status === 'gem') {
      hapticLight();
    } else if (cells[index]?.status === 'mine') {
      hapticHeavy();
    }

    if (newStatus === 'lost') {
      hapticError();
      await refreshBalance();
    } else if (newStatus === 'won') {
      hapticSuccess();
      await refreshBalance();
    }
  }, [store.revealCell, store.status, refreshBalance]);

  const handleCashOut = useCallback(async () => {
    try {
      await store.cashOut();
      hapticSuccess();
      await refreshBalance();
    } catch {
      hapticError();
    }
  }, [store.cashOut, refreshBalance]);

  const handleReset = useCallback(() => {
    store.reset();
  }, [store.reset]);

  return {
    ...store,
    startGame: handleStartGame,
    revealCell: handleRevealCell,
    cashOut: handleCashOut,
    reset: handleReset,
  };
}
