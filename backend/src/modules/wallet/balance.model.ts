import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBalance extends Document {
  userId: Types.ObjectId;
  available: number;
  locked: number;
  lifetimeDeposited: number;
  lifetimeWithdrawn: number;
  updatedAt: Date;
}

const balanceSchema = new Schema<IBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    available: { type: Number, default: 0 },     // nanoTON
    locked: { type: Number, default: 0 },         // nanoTON locked in active bets
    lifetimeDeposited: { type: Number, default: 0 },
    lifetimeWithdrawn: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  },
);

export const Balance = mongoose.model<IBalance>('Balance', balanceSchema);
