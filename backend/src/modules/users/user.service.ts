import { User, type IUser } from './user.model.js';
import { Balance } from '../wallet/balance.model.js';
import { redis } from '../../infrastructure/redis.js';
import { logger } from '../../utils/logger.js';
export async function findOrCreateUser(tgUser: {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}): Promise<IUser> {
  let user = await User.findOne({ telegramId: tgUser.id });

  if (user) {
    user.lastSeenAt = new Date();
    if (tgUser.username !== undefined) user.username = tgUser.username ?? null;
    if (tgUser.firstName) user.firstName = tgUser.firstName;
    if (tgUser.lastName !== undefined) user.lastName = tgUser.lastName ?? null;
    await user.save();
  } else {
    user = await User.create({
      telegramId: tgUser.id,
      username: tgUser.username ?? null,
      firstName: tgUser.firstName,
      lastName: tgUser.lastName ?? null,
    });

    await Balance.create({ userId: user._id });
    await redis.set(`balance:${user._id}`, '0');
    logger.info({ telegramId: tgUser.id, userId: user._id }, 'New user created');
  }

  return user;
}

export async function getUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId);
}

export async function getUserByTelegramId(telegramId: number): Promise<IUser | null> {
  return User.findOne({ telegramId });
}

export async function updateClientSeed(userId: string, newSeed: string): Promise<void> {
  await User.updateOne({ _id: userId }, { clientSeed: newSeed });
}

export async function incrementNonce(userId: string): Promise<number> {
  const user = await User.findByIdAndUpdate(userId, { $inc: { nonce: 1 } }, { new: true });
  return user?.nonce ?? 0;
}

export async function getUserStats(userId: string) {
  const balance = await Balance.findOne({ userId });
  return {
    available: balance?.available ?? 0,
    locked: balance?.locked ?? 0,
    lifetimeDeposited: balance?.lifetimeDeposited ?? 0,
    lifetimeWithdrawn: balance?.lifetimeWithdrawn ?? 0,
  };
}
