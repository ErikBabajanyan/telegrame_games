import './dice.css';

interface DiceBarProps {
  target: number;
  mode: 'under' | 'over';
  result: number | null;
  status: 'idle' | 'rolling' | 'result';
}

export function DiceBar({ target, mode, result, status }: DiceBarProps) {
  const winPercent = mode === 'under' ? target - 1 : 100 - target;
  const markerPos = status === 'result' && result !== null ? result : target;

  return (
    <div className="dice-bar-wrap">
      <div className="dice-bar">
        {mode === 'under' ? (
          <>
            <div className="dice-bar-fill dice-bar-win" style={{ width: `${winPercent}%` }} />
            <div className="dice-bar-fill dice-bar-lose" style={{ width: `${100 - winPercent}%`, left: `${winPercent}%` }} />
          </>
        ) : (
          <>
            <div className="dice-bar-fill dice-bar-lose" style={{ width: `${100 - winPercent}%` }} />
            <div className="dice-bar-fill dice-bar-win" style={{ width: `${winPercent}%`, left: `${100 - winPercent}%` }} />
          </>
        )}
        <div
          className={`dice-bar-marker ${status === 'result' ? (result !== null && ((mode === 'under' && result < target) || (mode === 'over' && result > target)) ? 'dice-marker-win' : 'dice-marker-lose') : ''}`}
          style={{ left: `${markerPos}%` }}
        />
      </div>
      <div className="dice-bar-labels">
        <span>0</span>
        <span className="dice-bar-target">{target}</span>
        <span>100</span>
      </div>
    </div>
  );
}
