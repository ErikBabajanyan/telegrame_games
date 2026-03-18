import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IGameRound extends Document {
  userId: Types.ObjectId;
  gameType: string;
  status: 'active' | 'won' | 'lost' | 'cashout';
  betAmount: number;           // nanoTON
  payoutAmount: number;        // nanoTON (0 if lost)
  multiplier: number;          // final applied multiplier
  provablyFair: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  mines: {
    mineCount: number;
    minePositions: number[];   // indices 0-24
    revealedCells: number[];   // sequence of cells clicked
  };
  createdAt: Date;
  endedAt: Date | null;
}

const gameRoundSchema = new Schema<IGameRound>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gameType: {
      type: String,
      required: true,
      enum: ['mines', 'hilo', 'dice', 'roulette'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'won', 'lost', 'cashout'],
      index: true,
    },
    betAmount: { type: Number, required: true },
    payoutAmount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    provablyFair: {
      serverSeed: { type: String, required: true },
      serverSeedHash: { type: String, required: true },
      clientSeed: { type: String, required: true },
      nonce: { type: Number, required: true },
    },
    mines: {
      mineCount: { type: Number },
      minePositions: [{ type: Number }],
      revealedCells: [{ type: Number }],
    },
    endedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Compound index for finding active games by user
gameRoundSchema.index({ userId: 1, status: 1 });
// TTL-like index for queries by creation date
gameRoundSchema.index({ createdAt: -1 });

export const GameRound = mongoose.model<IGameRound>('GameRound', gameRoundSchema);
