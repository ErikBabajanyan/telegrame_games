import mongoose, { Schema, type Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  tonAddress: string | null;
  nonce: number;
  clientSeed: string;
  role: 'player' | 'admin' | 'banned';
  limits: {
    dailyDeposit: number | null;
    selfExcludeUntil: Date | null;
  };
  createdAt: Date;
  lastSeenAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: { type: String, default: null },
    firstName: { type: String, required: true },
    lastName: { type: String, default: null },
    tonAddress: { type: String, default: null, index: true },
    nonce: { type: Number, default: 0 },
    clientSeed: {
      type: String,
      default: () => crypto.randomUUID().replace(/-/g, ''),
    },
    role: {
      type: String,
      enum: ['player', 'admin', 'banned'],
      default: 'player',
    },
    limits: {
      dailyDeposit: { type: Number, default: null },
      selfExcludeUntil: { type: Date, default: null },
    },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const User = mongoose.model<IUser>('User', userSchema);
