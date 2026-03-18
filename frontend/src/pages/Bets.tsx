import { useEffect } from 'react';
import { useBetStore } from '../stores/useBetStore';
import { Spinner } from '../components/ui/Spinner';
import { formatTon, formatMultiplier } from '../utils/formatTon';
import './pages.css';

export function Bets() {
  const { bets, total, page, totalPages, isLoading, fetchBets } = useBetStore();

  useEffect(() => {
    fetchBets(1);
  }, [fetchBets]);

  return (
    <div className="bets-page">
      <div className="page-header">
        <h2>📊 My Bets</h2>
        <span className="page-subtitle">{total} total bets</span>
      </div>

      {isLoading && bets.length === 0 ? (
        <div className="page-loader"><Spinner size={32} /></div>
      ) : bets.length === 0 ? (
        <div className="page-empty">No bets yet. Play a game to see your history!</div>
      ) : (
        <>
          <div className="bets-list">
            {bets.map((bet) => (
              <div key={bet.gameId} className={`bet-item bet-${bet.status}`}>
                <div className="bet-left">
                  <div className="bet-game">💣 Mines ({bet.mineCount} mines)</div>
                  <div className="bet-time">{new Date(bet.createdAt).toLocaleString()}</div>
                </div>
                <div className="bet-right">
                  <div className="bet-amount">
                    {bet.status === 'cashout'
                      ? <span className="bet-win">+{formatTon(bet.payoutAmount)} TON</span>
                      : <span className="bet-loss">-{formatTon(bet.betAmount)} TON</span>
                    }
                  </div>
                  <div className="bet-mult">
                    {bet.status === 'cashout' ? formatMultiplier(bet.multiplier) : 'Lost'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => fetchBets(page - 1)}
              >
                ← Prev
              </button>
              <span className="page-info">{page} / {totalPages}</span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => fetchBets(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
