import { useEffect } from 'react';
import { GameHeader } from '../components/layout/GameHeader';
import { MinesBoard } from '../components/games/MinesBoard';
import { MinesControls } from '../components/games/MinesControls';
import { useMinesGame } from '../hooks/useMinesGame';
import { useMinesStore } from '../stores/useMinesStore';
import { useWalletStore } from '../stores/useWalletStore';
import confetti from 'canvas-confetti';
import './pages.css';

export function MinesGame() {
  const {
    status, cells, mineCount, betAmount, currentMultiplier,
    currentPayout, isLoading, serverSeedHash,
    setBetAmount, setMineCount, startGame, revealCell, cashOut, reset,
  } = useMinesGame();

  const balance = useWalletStore((s) => s.available);
  const checkActiveGame = useMinesStore((s) => s.checkActiveGame);

  // Check for active game on mount (resume)
  useEffect(() => {
    checkActiveGame();
  }, [checkActiveGame]);

  // Confetti on win
  useEffect(() => {
    if (status === 'won') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }
  }, [status]);

  return (
    <div className="mines-page-v2">
      <GameHeader title="MINES" />

      {/* Board — always visible, center of screen */}
      <div className="mines-board-v2-area">
        <MinesBoard
          cells={cells}
          disabled={status !== 'active' || isLoading}
          gameStatus={status}
          onCellClick={revealCell}
        />
      </div>

      {/* Controls panel — bottom fixed area */}
      <MinesControls
        status={status}
        betAmount={betAmount}
        mineCount={mineCount}
        currentMultiplier={currentMultiplier}
        currentPayout={currentPayout}
        isLoading={isLoading}
        balance={balance}
        onBetAmountChange={setBetAmount}
        onMineCountChange={setMineCount}
        onBet={startGame}
        onCashOut={cashOut}
        onReset={reset}
      />

      {/* Provably fair hash — subtle footer */}
      {serverSeedHash && (
        <div className="mines-seed-v2">
          <span>🔐</span>
          <span className="mines-seed-hash">{serverSeedHash.slice(0, 12)}...{serverSeedHash.slice(-6)}</span>
        </div>
      )}
    </div>
  );
}
