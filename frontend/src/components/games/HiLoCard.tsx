import { motion, AnimatePresence } from 'framer-motion';
import type { Card } from '../../api/hilo';
import './hilo.css';

interface HiLoCardProps {
  card: Card | null;
  isRevealing?: boolean;
  lastResult?: { correct: boolean; card: Card } | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const SUIT_COLORS: Record<string, string> = {
  hearts: '#ef4444', diamonds: '#ef4444', clubs: '#e2e8f0', spades: '#e2e8f0',
};

function valueName(v: number): string {
  if (v === 1) return 'A';
  if (v === 11) return 'J';
  if (v === 12) return 'Q';
  if (v === 13) return 'K';
  return String(v);
}

export function HiLoCard({ card, isRevealing, lastResult }: HiLoCardProps) {
  if (!card) {
    return (
      <div className="hilo-card hilo-card-placeholder">
        <span className="hilo-card-question">?</span>
        <span className="hilo-card-sub">Place bet to start</span>
      </div>
    );
  }

  const suit = SUIT_SYMBOLS[card.suit] ?? '♠';
  const color = SUIT_COLORS[card.suit] ?? '#e2e8f0';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${card.value}-${card.suit}`}
        className={`hilo-card ${lastResult ? (lastResult.correct ? 'hilo-card-correct' : 'hilo-card-wrong') : ''}`}
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
      >
        <span className="hilo-card-suit-top" style={{ color }}>{suit}</span>
        <span className="hilo-card-value" style={{ color }}>{valueName(card.value)}</span>
        <span className="hilo-card-suit-bottom" style={{ color }}>{suit}</span>
      </motion.div>
    </AnimatePresence>
  );
}
