import { useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { formatTon, formatMultiplier } from '../../utils/formatTon';
import './games.css';

interface MinesControlsProps {
  status: 'idle' | 'active' | 'won' | 'lost';
  betAmount: number;
  mineCount: number;
  currentMultiplier: number;
  currentPayout: number;
  isLoading: boolean;
  balance: number;
  onBetAmountChange: (amount: number) => void;
  onMineCountChange: (count: number) => void;
  onBet: () => void;
  onCashOut: () => void;
  onReset: () => void;
}

export function MinesControls({
  status,
  betAmount,
  mineCount,
  currentMultiplier,
  currentPayout,
  isLoading,
  balance,
  onBetAmountChange,
  onMineCountChange,
  onBet,
  onCashOut,
  onReset,
}: MinesControlsProps) {
  const betTon = betAmount / 1_000_000_000;
  const scaleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active mine count on mount and change
  useEffect(() => {
    if (scaleRef.current && status === 'idle') {
      const activeEl = scaleRef.current.querySelector('.cv2-scale-item-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [mineCount, status]);

  return (
    <div className="controls-v2">
      {/* Active game: multiplier + cashout */}
      {status === 'active' && currentPayout > 0 && (
        <div className="cv2-multiplier-card">
          <div className="cv2-mult-row">
            <div className="cv2-mult-info">
              <span className="cv2-mult-label">Multiplier</span>
              <span className="cv2-mult-value">{formatMultiplier(currentMultiplier)}</span>
            </div>
            <div className="cv2-mult-divider" />
            <div className="cv2-mult-info">
              <span className="cv2-mult-label">Payout</span>
              <span className="cv2-mult-payout">{formatTon(currentPayout)} TON</span>
            </div>
          </div>
        </div>
      )}

      {/* Bet controls: only when idle */}
      {status === 'idle' && (
        <div className="cv2-bet-section">
          <div className="cv2-row">
            <span className="cv2-label">Bet Amount</span>
            <div className="cv2-bet-group">
              <button
                className="cv2-adj-btn"
                onClick={() => onBetAmountChange(Math.max(10_000_000, betAmount / 2))}
              >
                ½
              </button>
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
              <button
                className="cv2-adj-btn"
                onClick={() => onBetAmountChange(Math.min(balance, betAmount * 2))}
              >
                2x
              </button>
            </div>
          </div>

          <div className="cv2-row">
            <div className="cv2-label-row">
              <span className="cv2-label">Mines</span>
              <span className="cv2-label-value">{mineCount}</span>
            </div>
            <div className="cv2-scale-wrapper">
              <div className="cv2-scale-fade cv2-scale-fade-left" />
              <div className="cv2-scale-scroll" ref={scaleRef}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`cv2-scale-item ${mineCount === n ? 'cv2-scale-item-active' : ''}`}
                    onClick={() => onMineCountChange(n)}
                  >
                    <span className="cv2-scale-tick" />
                    <span className="cv2-scale-num">{n}</span>
                  </button>
                ))}
              </div>
              <div className="cv2-scale-fade cv2-scale-fade-right" />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="cv2-actions">
        {status === 'idle' && (
          <button
            className="cv2-main-btn cv2-btn-bet"
            onClick={onBet}
            disabled={isLoading || betAmount > balance}
          >
            {isLoading ? <Spinner size={20} /> : (
              <>
                <span className="cv2-btn-text">BET</span>
                <span className="cv2-btn-amount">{betTon} TON</span>
              </>
            )}
          </button>
        )}

        {status === 'active' && (
          <button
            className="cv2-main-btn cv2-btn-cashout"
            onClick={onCashOut}
            disabled={isLoading || currentPayout === 0}
          >
            {isLoading ? <Spinner size={20} /> : (
              <>
                <span className="cv2-btn-text">CASH OUT</span>
                <span className="cv2-btn-amount">{formatTon(currentPayout)} TON</span>
              </>
            )}
          </button>
        )}

        {(status === 'won' || status === 'lost') && (
          <div className="cv2-result-section">
            <div className={`cv2-result-banner ${status === 'won' ? 'cv2-result-win' : 'cv2-result-lose'}`}>
              <span className="cv2-result-icon">{status === 'won' ? '🎉' : '💥'}</span>
              <div className="cv2-result-text">
                <span className="cv2-result-title">
                  {status === 'won' ? 'YOU WON!' : 'MINE HIT'}
                </span>
                <span className="cv2-result-amount">
                  {status === 'won'
                    ? `+${formatTon(currentPayout)} TON (${formatMultiplier(currentMultiplier)})`
                    : `-${formatTon(betAmount)} TON`
                  }
                </span>
              </div>
            </div>
            <button className="cv2-main-btn cv2-btn-bet" onClick={onReset}>
              <span className="cv2-btn-text">PLAY AGAIN</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
