import { useUserStore } from '../stores/useUserStore';
import { useWalletStore } from '../stores/useWalletStore';
import { Button } from '../components/ui/Button';
import { formatTon } from '../utils/formatTon';
import './pages.css';

export function Profile() {
  const { firstName, username, telegramId, logout } = useUserStore();
  const { available, lifetimeDeposited, lifetimeWithdrawn } = useWalletStore();

  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>👤 Profile</h2>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {firstName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="profile-name">{firstName || 'Player'}</div>
        {username && <div className="profile-username">@{username}</div>}
        <div className="profile-id">ID: {telegramId}</div>
      </div>

      <div className="wallet-stats">
        <div className="stat-card">
          <div className="stat-label">Balance</div>
          <div className="stat-value">{formatTon(available)} TON</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Deposited</div>
          <div className="stat-value">{formatTon(lifetimeDeposited)} TON</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Withdrawn</div>
          <div className="stat-value">{formatTon(lifetimeWithdrawn)} TON</div>
        </div>
      </div>

      <div className="profile-actions">
        <Button variant="danger" fullWidth onClick={logout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
