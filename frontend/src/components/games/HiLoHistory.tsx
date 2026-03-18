import { useRef, useEffect } from 'react';
import { HiLoCardMini } from './HiLoCardMini';
import './hilo.css';

interface HiLoHistoryProps {
  history: { card: { value: number; suit: string }; guess: string; result: string; roundMultiplier: number }[];
}

export function HiLoHistory({ history }: HiLoHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [history.length]);

  if (history.length === 0) return null;

  return (
    <div className="hilo-history-wrap">
      <div className="hilo-history-scroll" ref={scrollRef}>
        {history.map((round, i) => (
          <HiLoCardMini key={i} card={round.card} result={round.result} />
        ))}
      </div>
    </div>
  );
}
