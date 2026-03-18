import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDiceRound extends Document {
  userId: Types.ObjectId;
  gameType: 'dice';
  status: 'won' | 'lost';
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  dice: {
    target: number;
    mode: 'under' | 'over';
    result: number;
    winProbability: number;
  };
  createdAt: Date;
}

const diceRoundSchema = new Schema<IDiceRound>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameType: { type: String, default: 'dice', enum: ['dice'] },
    status: { type: String, required: true, enum: ['won', 'lost'], index: true },
    betAmount: { type: Number, required: true },
    payoutAmount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 0 },
    dice: {
      target: { type: Number, required: true },
      mode: { type: String, required: true, enum: ['under', 'over'] },
      result: { type: Number, required: true },
      winProbability: { type: Number, required: true },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

diceRoundSchema.index({ userId: 1, createdAt: -1 });

export const DiceRound = mongoose.model<IDiceRound>('DiceRound', diceRoundSchema);
