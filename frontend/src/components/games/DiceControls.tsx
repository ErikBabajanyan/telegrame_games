import { Spinner } from '../ui/Spinner';
import { formatTon } from '../../utils/formatTon';
import './dice.css';

interface DiceControlsProps {
  status: 'idle' | 'rolling' | 'result';
  betAmount: number;
  target: number;
  mode: 'under' | 'over';
  winProbability: number;
  multiplier: number;
  lastResult: { result: number; win: boolean; payout: number; multiplier: number; profit: number } | null;
  isLoading: boolean;
  balance: number;
  onTargetChange: (n: number) => void;
  onModeChange: (m: 'under' | 'over') => void;
  onBetAmountChange: (n: number) => void;
  onWinChanceChange: (chance: number) => void;
  onRoll: () => void;
}

export function DiceControls({
  status, betAmount, target, mode, winProbability, multiplier,
  lastResult, isLoading, balance,
  onTargetChange, onModeChange, onBetAmountChange, onWinChanceChange, onRoll,
}: DiceControlsProps) {
  const betTon = betAmount / 1_000_000_000;
  const canRoll = status === 'idle' && !isLoading && betAmount <= balance;

  return (
    <div className="dice-controls">
      {/* Result banner */}
      {status === 'result' && lastResult && (
        <div className={`dice-result-banner ${lastResult.win ? 'dice-banner-win' : 'dice-banner-lose'}`}>
          <span className="dice-banner-icon">{lastResult.win ? '🎉' : '💥'}</span>
          <div className="dice-banner-text">
            <span className="dice-banner-title">{lastResult.win ? 'YOU WON!' : 'YOU LOST'}</span>
            <span className="dice-banner-amount">
              {lastResult.win
                ? `+${formatTon(lastResult.payout)} TON (${lastResult.multiplier}×)`
                : `-${formatTon(betAmount)} TON`
              }
            </span>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="dice-mode-row">
        <button
          className={`dice-mode-btn dice-mode-under ${mode === 'under' ? 'dice-mode-active' : ''}`}
          onClick={() => onModeChange('under')}
          disabled={status !== 'idle'}
        >
          ROLL UNDER
        </button>
        <button
          className={`dice-mode-btn dice-mode-over ${mode === 'over' ? 'dice-mode-active' : ''}`}
          onClick={() => onModeChange('over')}
          disabled={status !== 'idle'}
        >
          ROLL OVER
        </button>
      </div>

      {/* Target slider */}
      <div className="dice-target-row">
        <span className="dice-target-label">Target</span>
        <input
          type="range"
          className="dice-target-slider"
          min={2}
          max={98}
          value={target}
          onChange={(e) => onTargetChange(Number(e.target.value))}
          disabled={status !== 'idle'}
        />
        <span className="dice-target-val">{target}</span>
      </div>

      {/* Info grid */}
      <div className="dice-info-grid">
        <div className="dice-info-box dice-info-editable">
          <span className="dice-info-label">Win Chance</span>
          <div className="dice-chance-input-wrap">
            <input
              type="number"
              className="dice-chance-input dice-info-green"
              value={winProbability}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onWinChanceChange(v); }}
              min={1}
              max={97}
              step={1}
              disabled={status !== 'idle'}
            />
            <span className="dice-chance-unit">%</span>
          </div>
        </div>
        <div className="dice-info-box">
          <span className="dice-info-label">Multiplier</span>
          <span className="dice-info-val">{multiplier}×</span>
        </div>
        <div className="dice-info-box">
          <span className="dice-info-label">Profit</span>
          <span className="dice-info-val dice-info-amber">{formatTon(Math.floor(betAmount * multiplier) - betAmount)}</span>
        </div>
      </div>

      {/* Bet amount */}
      <div className="dice-bet-row">
        <button className="cv2-adj-btn" onClick={() => onBetAmountChange(Math.max(10_000_000, betAmount / 2))} disabled={status !== 'idle'}>½</button>
        <div className="cv2-input-wrap">
          <input
            type="number"
            className="cv2-input"
            value={betTon}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onBetAmountChange(Math.round(v * 1_000_000_000)); }}
            min={0.01}
            step={0.01}
            disabled={status !== 'idle'}
          />
          <span className="cv2-input-unit">TON</span>
        </div>
        <button className="cv2-adj-btn" onClick={() => onBetAmountChange(Math.min(balance, betAmount * 2))} disabled={status !== 'idle'}>2x</button>
      </div>

      {/* Roll button */}
      <button className="dice-roll-btn" onClick={onRoll} disabled={!canRoll}>
        {isLoading ? <Spinner size={20} /> : (
          <>
            <span className="dice-roll-text">🎲 {status === 'result' ? 'ROLL AGAIN' : 'ROLL'}</span>
            <span className="dice-roll-amount">{betTon} TON</span>
          </>
        )}
      </button>
    </div>
  );
}
