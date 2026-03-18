import { useWalletStore } from '../../stores/useWalletStore';
import { formatTon } from '../../utils/formatTon';
import './wallet.css';

export function BalancePill() {
  const available = useWalletStore((s) => s.available);

  return (
    <div className="balance-pill">
      💎 {formatTon(available)} TON
    </div>
  );
}
