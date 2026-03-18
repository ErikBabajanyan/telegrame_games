import { useEffect, useMemo } from 'react';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    setParams: (params: { text?: string; color?: string; is_active?: boolean }) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

function getWebApp(): TelegramWebApp | null {
  return (window as any).Telegram?.WebApp ?? null;
}

export function useTelegram() {
  const webApp = useMemo(() => getWebApp(), []);

  useEffect(() => {
    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor('#0d1526');
      webApp.setBackgroundColor('#0a0f1c');
    }
  }, [webApp]);

  return {
    webApp,
    initData: webApp?.initData ?? '',
    user: webApp?.initDataUnsafe?.user ?? null,
    isInTelegram: !!webApp?.initData,
  };
}
