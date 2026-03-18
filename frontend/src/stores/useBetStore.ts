import { create } from 'zustand';
import { getGameHistory, type GameHistoryItem } from '../api/games';

interface BetState {
  bets: GameHistoryItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;

  fetchBets: (page?: number) => Promise<void>;
}

export const useBetStore = create<BetState>((set) => ({
  bets: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: false,

  fetchBets: async (page = 1) => {
    set({ isLoading: true });
    try {
      const data = await getGameHistory(page);
      set({
        bets: data.games,
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
