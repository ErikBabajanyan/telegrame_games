import { Spinner } from '../ui/Spinner';
import { formatTon, formatMultiplier } from '../../utils/formatTon';
import './hilo.css';

interface HiLoControlsProps {
  status: 'idle' | 'active' | 'revealing' | 'won' | 'lost';
  betAmount: number;
  currentMultiplier: number;
  currentPayout: number;
  roundNumber: number;
  skipsRemaining: number;
  hiMultiplier: number;
  loMultiplier: number;
  hiProbability: number;
  loProbability: number;
  isLoading: boolean;
  balance: number;
  onBetAmountChange: (amount: number) => void;
  onGuessHigher: () => void;
  onGuessLower: () => void;
  onSkip: () => void;
  onCashOut: () => void;
  onBet: () => void;
  onReset: () => void;
}

export function HiLoControls({
  status, betAmount, currentMultiplier, currentPayout, roundNumber,
  skipsRemaining, hiMultiplier, loMultiplier, hiProbability, loProbability,
  isLoading, balance, onBetAmountChange, onGuessHigher, onGuessLower,
  onSkip, onCashOut, onBet, onReset,
}: HiLoControlsProps) {
  const betTon = betAmount / 1_000_000_000;
  const canGuess = status === 'active' && !isLoading;

  return (
    <div className="hilo-controls">
      {/* Multiplier bar during game */}
      {(status === 'active' || status === 'revealing') && currentPayout > 0 && (
        <div className="hilo-mult-bar">
          <div className="hilo-mult-col">
            <span className="hilo-mult-label">Round</span>
            <span className="hilo-mult-val">{roundNumber}</span>
          </div>
          <div className="hilo-mult-div" />
          <div className="hilo-mult-col">
            <span className="hilo-mult-label">Multiplier</span>
            <span className="hilo-mult-val">{formatMultiplier(currentMultiplier)}</span>
          </div>
          <div className="hilo-mult-div" />
          <div className="hilo-mult-col">
            <span className="hilo-mult-label">Payout</span>
            <span className="hilo-mult-pay">{formatTon(currentPayout)} TON</span>
          </div>
        </div>
      )}

      {/* HI / LO buttons */}
      {(status === 'active' || status === 'revealing') && (
        <div className="hilo-guess-row">
          <button
            className="hilo-guess-btn hilo-guess-hi"
            onClick={onGuessHigher}
            disabled={!canGuess || hiMultiplier === 0}
          >
            {isLoading ? <Spinner size={18} /> : (
              <>
                <span className="hilo-guess-arrow">▲</span>
                <span className="hilo-guess-text">HIGHER</span>
                <span className="hilo-guess-odds">{hiMultiplier > 0 ? `${hiMultiplier}× · ${hiProbability}%` : '—'}</span>
              </>
            )}
          </button>
          <button
            className="hilo-guess-btn hilo-guess-lo"
            onClick={onGuessLower}
            disabled={!canGuess || loMultiplier === 0}
          >
            {isLoading ? <Spinner size={18} /> : (
              <>
                <span className="hilo-guess-arrow">▼</span>
                <span className="hilo-guess-text">LOWER</span>
                <span className="hilo-guess-odds">{loMultiplier > 0 ? `${loMultiplier}× · ${loProbability}%` : '—'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Cashout + Skip */}
      {(status === 'active' || status === 'revealing') && (
        <div className="hilo-action-row">
          <button
            className="hilo-cashout-btn"
            onClick={onCashOut}
            disabled={!canGuess || currentPayout === 0}
          >
            <span className="hilo-cashout-text">CASH OUT</span>
            {currentPayout > 0 && <span className="hilo-cashout-amount">{formatTon(currentPayout)} TON</span>}
          </button>
          <button
            className="hilo-skip-btn"
            onClick={onSkip}
            disabled={!canGuess || skipsRemaining === 0}
          >
            SKIP
            <span className="hilo-skip-count">{skipsRemaining}</span>
          </button>
        </div>
      )}

      {/* Bet setup (idle) */}
      {status === 'idle' && (
        <div className="hilo-bet-section">
          <span className="hilo-bet-label">Bet Amount</span>
          <div className="hilo-bet-group">
            <button className="cv2-adj-btn" onClick={() => onBetAmountChange(Math.max(10_000_000, betAmount / 2))}>½</button>
            <div className="cv2-input-wrap">
              <input
                type="number"
                className="cv2-input"
                value={betTon}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onBetAmountChange(Math.round(val * 1_000_000_000));
                }}
                min={0.01}
                step={0.01}
              />
              <span className="cv2-input-unit">TON</span>
            </div>
            <button className="cv2-adj-btn" onClick={() => onBetAmountChange(Math.min(balance, betAmount * 2))}>2x</button>
          </div>
          <button className="hilo-start-btn" onClick={onBet} disabled={isLoading || betAmount > balance}>
            {isLoading ? <Spinner size={20} /> : <><span className="cv2-btn-text">BET</span><span className="cv2-btn-amount">{betTon} TON</span></>}
          </button>
        </div>
      )}

      {/* Result */}
      {(status === 'won' || status === 'lost') && (
        <div className="cv2-result-section">
          <div className={`cv2-result-banner ${status === 'won' ? 'cv2-result-win' : 'cv2-result-lose'}`}>
            <span className="cv2-result-icon">{status === 'won' ? '🎉' : '💥'}</span>
            <div className="cv2-result-text">
              <span className="cv2-result-title">{status === 'won' ? 'YOU WON!' : 'WRONG GUESS'}</span>
              <span className="cv2-result-amount">
                {status === 'won'
                  ? `+${formatTon(currentPayout)} TON (${formatMultiplier(currentMultiplier)})`
                  : `-${formatTon(betAmount)} TON`}
              </span>
            </div>
          </div>
          <button className="hilo-start-btn" onClick={onReset}>
            <span className="cv2-btn-text">PLAY AGAIN</span>
          </button>
        </div>
      )}
    </div>
  );
}
