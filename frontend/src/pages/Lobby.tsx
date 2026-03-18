import { useNavigate } from 'react-router-dom';
import { BalancePill } from '../components/wallet/BalancePill';
import './pages.css';

const games = [
  { id: 'mines', icon: '💣', name: 'Mines', live: true },
  { id: 'hilo', icon: '🃏', name: 'HiLo', live: true },
  { id: 'dice', icon: '🎲', name: 'Dice', live: true },
  { id: 'roulette', icon: '🎡', name: 'Roulette', live: false },
  { id: 'slots', icon: '🎰', name: 'Slots', live: false },
  { id: 'crash', icon: '💥', name: 'Crash', live: false },
  { id: 'coinflip', icon: '🪙', name: 'Coin Flip', live: false },
  { id: 'blackjack', icon: '🃏', name: 'Blackjack', live: false },
];

export function Lobby() {
  const navigate = useNavigate();

  return (
    <div className="lobby">
      <div className="lobby-header">
        <div className="lobby-logo">TON<span>Casino</span></div>
        <BalancePill />
      </div>

      <div className="lobby-tabs">
        <button className="tab tab-active">Games</button>
        <button className="tab">My Bets</button>
        <button className="tab">Stats</button>
      </div>

      <div className="games-grid">
        {games.map((game) => (
          <button
            key={game.id}
            className={`game-tile ${game.live ? 'game-tile-live' : 'game-tile-soon'}`}
            onClick={() => game.live && navigate(`/game/${game.id}`)}
            disabled={!game.live}
          >
            <div className="game-tile-icon">{game.icon}</div>
            <div className="game-tile-name">{game.name}</div>
            <div className={`game-tile-badge ${game.live ? 'badge-live' : 'badge-soon'}`}>
              {game.live ? '● Live' : 'Coming Soon'}
            </div>
            {!game.live && <div className="game-tile-overlay">COMING SOON</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
