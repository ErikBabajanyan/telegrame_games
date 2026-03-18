import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IHiLoRound {
  card: { value: number; suit: string };
  guess: 'higher' | 'lower';
  result: 'correct' | 'wrong';
  roundMultiplier: number;
}

export interface IHiLoGame extends Document {
  userId: Types.ObjectId;
  gameType: 'hilo';
  status: 'active' | 'won' | 'lost' | 'cashout';
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  hilo: {
    currentCard: { value: number; suit: string };
    history: IHiLoRound[];
    roundNumber: number;
    skipsUsed: number;
    maxSkips: number;
  };
  createdAt: Date;
  endedAt: Date | null;
}

const hiloGameSchema = new Schema<IHiLoGame>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameType: { type: String, default: 'hilo', enum: ['hilo'] },
    status: { type: String, required: true, enum: ['active', 'won', 'lost', 'cashout'], index: true },
    betAmount: { type: Number, required: true },
    payoutAmount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    hilo: {
      currentCard: {
        value: { type: Number, required: true },
        suit: { type: String, required: true },
      },
      history: [{
        card: { value: Number, suit: String },
        guess: { type: String, enum: ['higher', 'lower'] },
        result: { type: String, enum: ['correct', 'wrong'] },
        roundMultiplier: Number,
      }],
      roundNumber: { type: Number, default: 1 },
      skipsUsed: { type: Number, default: 0 },
      maxSkips: { type: Number, default: 3 },
    },
    endedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

hiloGameSchema.index({ userId: 1, status: 1 });
hiloGameSchema.index({ createdAt: -1 });

export const HiLoGame = mongoose.model<IHiLoGame>('HiLoGame', hiloGameSchema);
