import { useLocation, useNavigate } from 'react-router-dom';
import './layout.css';

const tabs = [
  { path: '/', icon: '🎮', label: 'Games' },
  { path: '/bets', icon: '📊', label: 'Bets' },
  { path: '/wallet', icon: '💎', label: 'Wallet' },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on game screens
  if (location.pathname.startsWith('/game/')) return null;

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`nav-item ${location.pathname === tab.path ? 'nav-active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
