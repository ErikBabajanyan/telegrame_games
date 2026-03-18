import { useEffect } from 'react';
import { GameHeader } from '../components/layout/GameHeader';
import { DiceResult } from '../components/games/DiceResult';
import { DiceBar } from '../components/games/DiceBar';
import { DiceControls } from '../components/games/DiceControls';
import { useDiceStore } from '../stores/useDiceStore';
import { useWalletStore } from '../stores/useWalletStore';
import { hapticLight, hapticHeavy, hapticSuccess } from '../utils/haptics';
import confetti from 'canvas-confetti';
import './pages.css';

export function DiceGame() {
  const {
    status, betAmount, target, mode, winProbability, multiplier,
    lastResult, isLoading,
    setTarget, setMode, setBetAmount, setWinChance, roll,
  } = useDiceStore();

  const balance = useWalletStore((s) => s.available);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  useEffect(() => {
    if (status === 'result' && lastResult) {
      if (lastResult.win) {
        hapticSuccess();
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
      } else {
        hapticHeavy();
      }
      refreshBalance();
    }
  }, [status, lastResult, refreshBalance]);

  const handleRoll = async () => {
    hapticLight();
    await roll();
  };

  return (
    <div className="dice-page">
      <GameHeader title="DICE" />

      <div className="dice-main-area">
        <DiceResult
          status={status}
          result={lastResult?.result ?? null}
          win={lastResult?.win ?? null}
        />
        <DiceBar
          target={target}
          mode={mode}
          result={lastResult?.result ?? null}
          status={status}
        />
      </div>

      <DiceControls
        status={status}
        betAmount={betAmount}
        target={target}
        mode={mode}
        winProbability={winProbability}
        multiplier={multiplier}
        lastResult={lastResult}
        isLoading={isLoading}
        balance={balance}
        onTargetChange={setTarget}
        onModeChange={setMode}
        onBetAmountChange={setBetAmount}
        onWinChanceChange={setWinChance}
        onRoll={handleRoll}
      />
    </div>
  );
}
