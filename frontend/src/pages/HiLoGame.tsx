import { useEffect } from 'react';
import { GameHeader } from '../components/layout/GameHeader';
import { HiLoCard } from '../components/games/HiLoCard';
import { HiLoHistory } from '../components/games/HiLoHistory';
import { HiLoControls } from '../components/games/HiLoControls';
import { useHiLoGame } from '../hooks/useHiLoGame';
import { useHiLoStore } from '../stores/useHiLoStore';
import { useWalletStore } from '../stores/useWalletStore';
import confetti from 'canvas-confetti';
import './pages.css';

export function HiLoGame() {
  const {
    status, currentCard, history, betAmount, roundNumber,
    currentMultiplier, currentPayout, skipsRemaining,
    hiMultiplier, loMultiplier, hiProbability, loProbability,
    lastResult, isLoading,
    setBetAmount, startGame, guessHigher, guessLower, skip, cashOut, reset,
  } = useHiLoGame();

  const balance = useWalletStore((s) => s.available);
  const checkActiveGame = useHiLoStore((s) => s.checkActiveGame);

  useEffect(() => { checkActiveGame(); }, [checkActiveGame]);

  useEffect(() => {
    if (status === 'won') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    }
  }, [status]);

  return (
    <div className="hilo-page">
      <GameHeader title="HILO" />

      {/* Card history strip */}
      <HiLoHistory history={history} />

      {/* Main card area */}
      <div className="hilo-card-area">
        {status !== 'idle' && (
          <span className="hilo-card-label">
            {status === 'revealing' ? 'Revealing...' : status === 'active' ? 'Current Card' : ''}
          </span>
        )}
        <HiLoCard
          card={currentCard}
          isRevealing={status === 'revealing'}
          lastResult={lastResult}
        />
      </div>

      {/* Controls */}
      <HiLoControls
        status={status}
        betAmount={betAmount}
        currentMultiplier={currentMultiplier}
        currentPayout={currentPayout}
        roundNumber={roundNumber}
        skipsRemaining={skipsRemaining}
        hiMultiplier={hiMultiplier}
        loMultiplier={loMultiplier}
        hiProbability={hiProbability}
        loProbability={loProbability}
        isLoading={isLoading}
        balance={balance}
        onBetAmountChange={setBetAmount}
        onGuessHigher={guessHigher}
        onGuessLower={guessLower}
        onSkip={skip}
        onCashOut={cashOut}
        onBet={startGame}
        onReset={reset}
      />
    </div>
  );
}
