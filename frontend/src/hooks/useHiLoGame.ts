import { useCallback } from 'react';
import { useHiLoStore } from '../stores/useHiLoStore';
import { useWalletStore } from '../stores/useWalletStore';
import { hapticLight, hapticHeavy, hapticSuccess, hapticError } from '../utils/haptics';

export function useHiLoGame() {
  const store = useHiLoStore();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  const handleStartGame = useCallback(async () => {
    try { await store.startGame(); hapticLight(); }
    catch { hapticError(); }
  }, [store.startGame]);

  const handleGuessHigher = useCallback(async () => {
    await store.guessHigher();
    const { status } = useHiLoStore.getState();
    if (status === 'lost') { hapticHeavy(); await refreshBalance(); }
    else if (status === 'active') { hapticLight(); }
  }, [store.guessHigher, refreshBalance]);

  const handleGuessLower = useCallback(async () => {
    await store.guessLower();
    const { status } = useHiLoStore.getState();
    if (status === 'lost') { hapticHeavy(); await refreshBalance(); }
    else if (status === 'active') { hapticLight(); }
  }, [store.guessLower, refreshBalance]);

  const handleSkip = useCallback(async () => {
    await store.skip(); hapticLight();
  }, [store.skip]);

  const handleCashOut = useCallback(async () => {
    await store.cashOut(); hapticSuccess(); await refreshBalance();
  }, [store.cashOut, refreshBalance]);

  return {
    ...store,
    startGame: handleStartGame,
    guessHigher: handleGuessHigher,
    guessLower: handleGuessLower,
    skip: handleSkip,
    cashOut: handleCashOut,
  };
}
