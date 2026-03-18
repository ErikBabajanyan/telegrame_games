import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { useTonConnect } from '../../hooks/useTonConnect';
import { useWalletStore } from '../../stores/useWalletStore';
import { tonToNano } from '../../utils/formatTon';
import './wallet.css';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amount, setAmount] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { sendDeposit } = useTonConnect();
  const deposit = useWalletStore((s) => s.deposit);

  const handleDeposit = async () => {
    const tonAmount = parseFloat(amount);
    if (isNaN(tonAmount) || tonAmount < 0.1) {
      setError('Minimum deposit is 0.1 TON');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // 1. Send on-chain transaction via TON Connect
      const txHash = await sendDeposit(tonToNano(tonAmount));

      // 2. Verify with backend
      await deposit(txHash);

      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit TON">
      <div className="deposit-form">
        <label className="form-label">Amount (TON)</label>
        <input
          type="number"
          className="form-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0.1"
          step="0.1"
          disabled={isProcessing}
        />
        <div className="quick-amounts">
          {[0.5, 1, 5, 10, 50].map((v) => (
            <button key={v} className="quick-btn" onClick={() => setAmount(String(v))}>
              {v} TON
            </button>
          ))}
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button variant="primary" fullWidth onClick={handleDeposit} disabled={isProcessing}>
          {isProcessing ? <Spinner size={16} /> : 'Deposit'}
        </Button>
      </div>
    </Modal>
  );
}
