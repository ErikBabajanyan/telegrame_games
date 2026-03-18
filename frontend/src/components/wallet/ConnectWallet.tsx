import { useTonConnect } from '../../hooks/useTonConnect';
import { Button } from '../ui/Button';
import './wallet.css';

export function ConnectWallet() {
  const { isConnected, address, walletName, connect, disconnect } = useTonConnect();

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <span className="wallet-status">● Connected</span>
          <span className="wallet-name">{walletName}</span>
          <span className="wallet-addr">{address}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button variant="primary" fullWidth onClick={connect}>
      Connect TON Wallet
    </Button>
  );
}
