import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './dice.css';

interface DiceResultProps {
  status: 'idle' | 'rolling' | 'result';
  result: number | null;
  win: boolean | null;
}

export function DiceResult({ status, result, win }: DiceResultProps) {
  const [displayNum, setDisplayNum] = useState<string>('—');

  // Spinning number animation during roll
  useEffect(() => {
    if (status !== 'rolling') return;
    const interval = setInterval(() => {
      setDisplayNum(String(Math.floor(Math.random() * 100) + 1));
    }, 50);
    return () => clearInterval(interval);
  }, [status]);

  // Show final result
  useEffect(() => {
    if (status === 'result' && result !== null) {
      setDisplayNum(String(result));
    }
    if (status === 'idle') {
      setDisplayNum('—');
    }
  }, [status, result]);

  const colorClass = status === 'result'
    ? (win ? 'dice-num-win' : 'dice-num-lose')
    : status === 'rolling' ? 'dice-num-rolling' : '';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status === 'result' ? 'result' : 'spin'}
        className={`dice-result-num ${colorClass}`}
        initial={status === 'result' ? { scale: 1.4 } : false}
        animate={status === 'result' && !win
          ? { scale: 1, x: [0, -4, 4, -4, 4, 0] }
          : { scale: 1 }
        }
        transition={{ duration: 0.4 }}
      >
        {displayNum}
      </motion.div>
    </AnimatePresence>
  );
}
