import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Lobby } from './pages/Lobby';
import { MinesGame } from './pages/MinesGame';
import { HiLoGame } from './pages/HiLoGame';
import { DiceGame } from './pages/DiceGame';
import { Wallet } from './pages/Wallet';
import { Bets } from './pages/Bets';
import { Profile } from './pages/Profile';
import { useTelegram } from './hooks/useTelegram';
import { useWebSocket } from './hooks/useWebSocket';
import { useUserStore } from './stores/useUserStore';
import { useWalletStore } from './stores/useWalletStore';

function AppContent() {
  const { initData, isInTelegram } = useTelegram();
  const { isAuthenticated, login } = useUserStore();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  // Connect WebSocket after auth
  useWebSocket();

  // Auto-login via Telegram initData on app open
  useEffect(() => {
    if (isAuthenticated) return;
    if (!initData) return;

    login(initData).catch(() => {});
  }, [initData, isAuthenticated, login, isInTelegram]);

  // Refresh balance on auth
  useEffect(() => {
    if (isAuthenticated) {
      refreshBalance();
    }
  }, [isAuthenticated, refreshBalance]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/mines" element={<MinesGame />} />
        <Route path="/game/hilo" element={<HiLoGame />} />
        <Route path="/game/dice" element={<DiceGame />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/bets" element={<Bets />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
