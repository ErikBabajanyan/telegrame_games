import { MinesCell } from './MinesCell';
import type { CellState } from '../../stores/useMinesStore';
import { motion } from 'framer-motion';
import './games.css';

interface MinesBoardProps {
  cells: CellState[];
  disabled: boolean;
  gameStatus: 'idle' | 'active' | 'won' | 'lost';
  onCellClick: (index: number) => void;
}

export function MinesBoard({ cells, disabled, gameStatus, onCellClick }: MinesBoardProps) {
  return (
    <div className="board-v2-wrapper">
      <motion.div
        className="board-v2-grid"
        animate={gameStatus === 'lost' ? { x: [0, -6, 6, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        {cells.map((cell) => (
          <MinesCell
            key={cell.index}
            index={cell.index}
            status={cell.status}
            disabled={disabled}
            onClick={onCellClick}
          />
        ))}
      </motion.div>
    </div>
  );
}
