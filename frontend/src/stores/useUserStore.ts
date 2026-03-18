import { create } from 'zustand';
import { loginWithTelegram, logout as apiLogout } from '../api/auth';

interface UserState {
  isAuthenticated: boolean;
  userId: string | null;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  role: string | null;
  isLoading: boolean;

  login: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  isAuthenticated: false,
  userId: null,
  telegramId: null,
  username: null,
  firstName: null,
  role: null,
  isLoading: false,

  login: async (initData: string) => {
    set({ isLoading: true });
    try {
      const result = await loginWithTelegram(initData);
      set({
        isAuthenticated: true,
        userId: result.user.id,
        telegramId: result.user.telegramId,
        username: result.user.username,
        firstName: result.user.firstName,
        role: result.user.role,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiLogout();
    } finally {
      set({
        isAuthenticated: false,
        userId: null,
        telegramId: null,
        username: null,
        firstName: null,
        role: null,
      });
    }
  },
}));
