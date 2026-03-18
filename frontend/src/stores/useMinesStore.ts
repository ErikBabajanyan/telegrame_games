import { create } from 'zustand';
import { startMinesGame, revealCell as apiRevealCell, cashoutGame, getActiveGame } from '../api/games';

export type CellStatus = 'hidden' | 'gem' | 'mine' | 'loading';

export interface CellState {
  index: number;
  status: CellStatus;
}

interface MinesState {
  // Game session
  gameId: string | null;
  status: 'idle' | 'active' | 'won' | 'lost';
  mineCount: number;
  betAmount: number;           // nanoTON
  cells: CellState[];
  revealedCount: number;
  currentMultiplier: number;
  currentPayout: number;       // nanoTON
  serverSeedHash: string | null;
  serverSeed: string | null;
  clientSeed: string | null;
  nonce: number | null;
  minePositions: number[] | null;
  isLoading: boolean;

  // Actions
  setBetAmount: (amount: number) => void;
  setMineCount: (count: number) => void;
  checkActiveGame: () => Promise<void>;
  startGame: () => Promise<void>;
  revealCell: (index: number) => Promise<void>;
  cashOut: () => Promise<void>;
  reset: () => void;
}

function createInitialCells(): CellState[] {
  return Array.from({ length: 25 }, (_, i) => ({ index: i, status: 'hidden' as CellStatus }));
}

export const useMinesStore = create<MinesState>((set, get) => ({
  gameId: null,
  status: 'idle',
  mineCount: 3,
  betAmount: 100_000_000, // 0.1 TON default
  cells: createInitialCells(),
  revealedCount: 0,
  currentMultiplier: 1,
  currentPayout: 0,
  serverSeedHash: null,
  serverSeed: null,
  clientSeed: null,
  nonce: null,
  minePositions: null,
  isLoading: false,

  setBetAmount: (amount) => set({ betAmount: amount }),
  setMineCount: (count) => set({ mineCount: count }),

  checkActiveGame: async () => {
    try {
      const data = await getActiveGame();
      if (data.active && data.game) {
        const g = data.game;
        // Rebuild cells from server state
        const cells: CellState[] = g.cells.map((c) => ({
          index: c.index,
          status: c.status as CellStatus,
        }));

        set({
          gameId: g.gameId,
          status: 'active',
          betAmount: g.betAmount,
          mineCount: g.mineCount,
          cells,
          revealedCount: g.revealedCount,
          currentMultiplier: g.currentMultiplier,
          currentPayout: g.currentPayout,
          serverSeedHash: g.serverSeedHash,
          clientSeed: g.clientSeed,
          nonce: g.nonce,
          serverSeed: null,
          minePositions: null,
          isLoading: false,
        });
      }
    } catch {
      // No active game or error — stay idle
    }
  },

  startGame: async () => {
    const { betAmount, mineCount } = get();
    set({ isLoading: true });
    try {
      const result = await startMinesGame(betAmount, mineCount);
      set({
        gameId: result.gameId,
        status: 'active',
        cells: createInitialCells(),
        revealedCount: 0,
        currentMultiplier: 1,
        currentPayout: 0,
        serverSeedHash: result.serverSeedHash,
        serverSeed: null,
        clientSeed: result.clientSeed,
        nonce: result.nonce,
        minePositions: null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  revealCell: async (index) => {
    const { gameId, cells, status } = get();
    if (!gameId || status !== 'active') return;
    if (cells[index].status !== 'hidden') return;

    // Optimistic: mark as loading
    const newCells = [...cells];
    newCells[index] = { ...newCells[index], status: 'loading' };
    set({ cells: newCells, isLoading: true });

    try {
      const result = await apiRevealCell(gameId, index);
      const updatedCells = [...get().cells];

      if (result.result === 'gem') {
        updatedCells[index] = { ...updatedCells[index], status: 'gem' };
        set({
          cells: updatedCells,
          revealedCount: result.revealedCount,
          currentMultiplier: result.currentMultiplier,
          currentPayout: result.currentPayout,
          isLoading: false,
        });

        // Auto-cashout: all safe cells revealed
        if (result.autoCashout) {
          set({
            status: 'won',
            serverSeed: result.serverSeed ?? null,
            minePositions: result.minePositions ?? null,
          });
        }
      } else {
        // Mine hit — reveal all mines
        updatedCells[index] = { ...updatedCells[index], status: 'mine' };
        if (result.minePositions) {
          for (const pos of result.minePositions) {
            if (pos !== index) {
              updatedCells[pos] = { ...updatedCells[pos], status: 'mine' };
            }
          }
        }
        set({
          cells: updatedCells,
          status: 'lost',
          currentMultiplier: 0,
          currentPayout: 0,
          serverSeed: result.serverSeed ?? null,
          minePositions: result.minePositions ?? null,
          isLoading: false,
        });
      }
    } catch {
      // Revert loading state on error
      const revertedCells = [...get().cells];
      revertedCells[index] = { ...revertedCells[index], status: 'hidden' };
      set({ cells: revertedCells, isLoading: false });
    }
  },

  cashOut: async () => {
    const { gameId } = get();
    if (!gameId) return;
    set({ isLoading: true });
    try {
      const result = await cashoutGame(gameId);

      // Reveal all mine positions
      const updatedCells = [...get().cells];
      if (result.minePositions) {
        for (const pos of result.minePositions) {
          updatedCells[pos] = { ...updatedCells[pos], status: 'mine' };
        }
      }

      set({
        status: 'won',
        currentMultiplier: result.multiplier,
        currentPayout: result.payout,
        serverSeed: result.serverSeed,
        minePositions: result.minePositions,
        cells: updatedCells,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  reset: () => {
    set({
      gameId: null,
      status: 'idle',
      cells: createInitialCells(),
      revealedCount: 0,
      currentMultiplier: 1,
      currentPayout: 0,
      serverSeedHash: null,
      serverSeed: null,
      clientSeed: null,
      nonce: null,
      minePositions: null,
      isLoading: false,
    });
  },
}));
