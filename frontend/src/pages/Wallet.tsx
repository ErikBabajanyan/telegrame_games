import { useState, useEffect } from 'react';
import { useWalletStore } from '../stores/useWalletStore';
import { ConnectWallet } from '../components/wallet/ConnectWallet';
import { DepositModal } from '../components/wallet/DepositModal';
import { WithdrawModal } from '../components/wallet/WithdrawModal';
import { Button } from '../components/ui/Button';
import { formatTon } from '../utils/formatTon';
import { getTransactions, type TransactionItem } from '../api/wallet';
import './pages.css';

export function Wallet() {
  const { available, locked, lifetimeDeposited, lifetimeWithdrawn, refreshBalance } = useWalletStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    refreshBalance();
    // Only show deposits and withdrawals — bets/wins are in the Bets page
    Promise.all([
      getTransactions(1, 10, 'deposit'),
      getTransactions(1, 10, 'withdrawal'),
    ]).then(([deposits, withdrawals]) => {
      const merged = [...deposits.transactions, ...withdrawals.transactions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setTransactions(merged);
    }).catch(() => {});
  }, [refreshBalance]);

  const txIcon = (type: string) => {
    return type === 'deposit' ? '⬆' : '⬇';
  };

  return (
    <div className="wallet-page">
      <div className="wallet-page-header">
        <h2>💎 Wallet</h2>
      </div>

      {/* Balance Card */}
      <div className="wallet-card">
        <div className="wallet-balance-large">{formatTon(available)} TON</div>
        {locked > 0 && (
          <div className="wallet-locked">🔒 {formatTon(locked)} TON in active bets</div>
        )}
        <ConnectWallet />
      </div>

      {/* Action Buttons */}
      <div className="wallet-actions">
        <Button variant="primary" fullWidth onClick={() => setShowDeposit(true)}>
          ⬆ Deposit
        </Button>
        <Button variant="success" fullWidth onClick={() => setShowWithdraw(true)}>
          ⬇ Withdraw
        </Button>
      </div>

      {/* Stats */}
      <div className="wallet-stats">
        <div className="stat-card">
          <div className="stat-label">Total Deposited</div>
          <div className="stat-value">{formatTon(lifetimeDeposited)} TON</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Withdrawn</div>
          <div className="stat-value">{formatTon(lifetimeWithdrawn)} TON</div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="tx-section">
        <h3 className="tx-section-title">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <div className="tx-empty">No transactions yet</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx._id} className="tx-item">
              <div className="tx-left">
                <div className={`tx-icon tx-icon-${tx.type}`}>{txIcon(tx.type)}</div>
                <div className="tx-info">
                  <div className="tx-type">{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</div>
                  <div className="tx-time">{new Date(tx.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className={`tx-amount ${tx.type === 'deposit' ? 'tx-pos' : 'tx-neg'}`}>
                {tx.type === 'deposit' ? '+' : '-'}{formatTon(tx.amount)} TON
              </div>
            </div>
          ))
        )}
      </div>

      <DepositModal isOpen={showDeposit} onClose={() => setShowDeposit(false)} />
      <WithdrawModal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} />
    </div>
  );
}
