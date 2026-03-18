import { motion } from 'framer-motion';
import type { CellStatus } from '../../stores/useMinesStore';
import './games.css';

interface MinesCellProps {
  index: number;
  status: CellStatus;
  disabled: boolean;
  onClick: (index: number) => void;
}

// SVG fallbacks — guaranteed rendering on all platforms
const GemIcon = () => (
  <svg className="cell-icon cell-icon-gem" viewBox="0 0 36 36" fill="none">
    <path d="M18 3L4 14L18 33L32 14L18 3Z" fill="#2DD4BF" />
    <path d="M18 3L4 14H32L18 3Z" fill="#5EEAD4" />
    <path d="M18 33L4 14H18V33Z" fill="#14B8A6" />
    <path d="M18 33L32 14H18V33Z" fill="#0D9488" />
    <path d="M18 3L11 14H18V3Z" fill="#99F6E4" />
    <path d="M18 3L25 14H18V3Z" fill="#5EEAD4" />
  </svg>
);

const MineIcon = () => (
  <svg className="cell-icon cell-icon-mine" viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="10" fill="#4A4A4A" />
    <circle cx="18" cy="18" r="8" fill="#2A2A2A" />
    <circle cx="15" cy="15" r="2.5" fill="rgba(255,255,255,0.3)" />
    <line x1="18" y1="4" x2="18" y2="8" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="18" y1="28" x2="18" y2="32" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="4" y1="18" x2="8" y2="18" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="28" y1="18" x2="32" y2="18" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="8" y1="8" x2="11" y2="11" stroke="#666" strokeWidth="2" strokeLinecap="round" />
    <line x1="25" y1="25" x2="28" y2="28" stroke="#666" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="8" x2="25" y2="11" stroke="#666" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="28" x2="11" y2="25" stroke="#666" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function MinesCell({ index, status, disabled, onClick }: MinesCellProps) {
  const handleClick = () => {
    if (status !== 'hidden' || disabled) return;
    onClick(index);
  };

  return (
    <motion.button
      className={`cell-v2 cell-v2-${status}`}
      onClick={handleClick}
      disabled={status !== 'hidden' || disabled}
      whileTap={status === 'hidden' && !disabled ? { scale: 0.92 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      {status === 'hidden' && (
        <div className="cell-v2-inner">
          <div className="cell-v2-dot" />
        </div>
      )}

      {status === 'loading' && (
        <div className="cell-v2-inner">
          <div className="cell-v2-spinner" />
        </div>
      )}

      {status === 'gem' && (
        <motion.div
          className="cell-v2-inner cell-v2-reveal-gem"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        >
          <GemIcon />
        </motion.div>
      )}

      {status === 'mine' && (
        <motion.div
          className="cell-v2-inner cell-v2-reveal-mine"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{ duration: 0.4, times: [0, 0.6, 1] }}
        >
          <MineIcon />
        </motion.div>
      )}
    </motion.button>
  );
}
