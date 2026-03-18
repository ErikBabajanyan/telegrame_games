import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTonConnect } from '../../hooks/useTonConnect';
import { tonToNano, formatTon } from '../../utils/formatTon';
import './wallet.css';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { address } = useTonConnect();
  const { available, withdraw } = useWalletStore();

  const handleWithdraw = async () => {
    const tonAmount = parseFloat(amount);
    if (isNaN(tonAmount) || tonAmount < 0.5) {
      setError('Minimum withdrawal is 0.5 TON');
      return;
    }
    if (!address) {
      setError('Connect your wallet first');
      return;
    }

    const totalNeeded = tonToNano(tonAmount) + 100_000_000; // amount + 0.1 TON fee
    if (totalNeeded > available) {
      setError('Insufficient balance (amount + 0.1 TON fee)');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await withdraw(tonToNano(tonAmount), address);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Withdraw TON">
      <div className="deposit-form">
        <div className="withdraw-info">
          Available: {formatTon(available)} TON
          <br />
          <span className="form-hint">Fee: 0.1 TON per withdrawal</span>
        </div>
        <label className="form-label">Amount (TON)</label>
        <input
          type="number"
          className="form-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0.5"
          step="0.5"
          disabled={isProcessing}
        />
        <div className="withdraw-to">
          To: <span className="wallet-addr">{address || 'Not connected'}</span>
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button variant="success" fullWidth onClick={handleWithdraw} disabled={isProcessing}>
          {isProcessing ? <Spinner size={16} /> : 'Withdraw'}
        </Button>
      </div>
    </Modal>
  );
}
