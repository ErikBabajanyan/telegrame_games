import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  userId: Types.ObjectId;
  toAddress: string;
  amount: number;             // nanoTON
  fee: number;                // flat fee in nanoTON (0.1 TON = 100_000_000)
  status: 'pending' | 'processing' | 'sent' | 'failed';
  txHash: string | null;
  retries: number;
  reviewRequired: boolean;    // true if amount > 100 TON
  createdAt: Date;
}

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toAddress: { type: String, required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 100_000_000 }, // 0.1 TON
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    txHash: { type: String, default: null },
    retries: { type: Number, default: 0 },
    reviewRequired: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>(
  'WithdrawalRequest',
  withdrawalRequestSchema,
);
