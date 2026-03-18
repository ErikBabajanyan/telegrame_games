import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'refund';
  amount: number;              // always positive nanoTON; direction from type
  balanceBefore: number;       // snapshot of available balance before tx
  balanceAfter: number;        // snapshot of available balance after tx
  txHash: string | null;       // on-chain TON tx hash (deposits/withdrawals only)
  gameRoundId: Types.ObjectId | null;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund'],
      index: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    txHash: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    gameRoundId: {
      type: Schema.Types.ObjectId,
      ref: 'GameRound',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'confirmed',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

transactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
