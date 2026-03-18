import './hilo.css';
import type { Card } from '../../api/hilo';

interface HiLoCardMiniProps {
  card: Card;
  result: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

function valueName(v: number): string {
  if (v === 1) return 'A';
  if (v === 11) return 'J';
  if (v === 12) return 'Q';
  if (v === 13) return 'K';
  return String(v);
}

export function HiLoCardMini({ card, result }: HiLoCardMiniProps) {
  const suit = SUIT_SYMBOLS[card.suit] ?? '♠';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div className={`hilo-mini ${result === 'correct' ? 'hilo-mini-correct' : 'hilo-mini-wrong'}`}>
      <span className={`hilo-mini-value ${isRed ? 'hilo-mini-red' : ''}`}>
        {valueName(card.value)}
      </span>
      <span className={`hilo-mini-suit ${isRed ? 'hilo-mini-red' : ''}`}>
        {suit}
      </span>
    </div>
  );
}
