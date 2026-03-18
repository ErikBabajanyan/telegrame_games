import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../../stores/useWalletStore';
import { formatTon } from '../../utils/formatTon';
import './layout.css';

interface GameHeaderProps {
  title: string;
}

export function GameHeader({ title }: GameHeaderProps) {
  const navigate = useNavigate();
  const available = useWalletStore((s) => s.available);

  return (
    <header className="game-header-v2">
      <button className="gh-back" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className="gh-title">{title}</span>
      <div className="gh-balance">
        <span className="gh-balance-icon">💎</span>
        <span className="gh-balance-value">{formatTon(available)}</span>
        <span className="gh-balance-unit">TON</span>
      </div>
    </header>
  );
}
