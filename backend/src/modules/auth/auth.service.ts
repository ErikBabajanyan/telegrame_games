import { verifyTelegramInitData, parseTelegramUser } from '../../middleware/validateTelegram.js';
import { signAccessToken, signRefreshToken, verifyToken, blacklistToken } from '../../middleware/authenticate.js';
import { redis } from '../../infrastructure/redis.js';
import { config } from '../../config.js';
import { findOrCreateUser } from '../users/user.service.js';
import { logger } from '../../utils/logger.js';
import type { JwtPayload } from '../../types/auth.types.js';
import type { AuthResult, AuthTokens } from '../../types/auth.types.js';
import { UnauthorizedError, ForbiddenError } from '../../types/errors.js';

/**
 * Authenticate via Telegram initData.
 */
export async function authenticateWithTelegram(initData: string): Promise<AuthResult> {
  logger.debug({ initDataLength: initData.length }, 'Verifying Telegram initData');
  if (!verifyTelegramInitData(initData)) {
    logger.warn('Telegram initData HMAC verification failed');
    throw new UnauthorizedError('Invalid Telegram initData signature');
  }

  const tgUser = parseTelegramUser(initData);
  logger.debug({ tgUser }, 'Parsed Telegram user');
  if (!tgUser) {
    throw new UnauthorizedError('Could not parse Telegram user');
  }

  const user = await findOrCreateUser({
    id: tgUser.id,
    firstName: tgUser.firstName,
    lastName: tgUser.lastName,
    username: tgUser.username,
  });

  if (user.role === 'banned') {
    throw new ForbiddenError('Account is suspended');
  }

  if (user.limits.selfExcludeUntil && user.limits.selfExcludeUntil > new Date()) {
    throw new ForbiddenError('Account is self-excluded');
  }

  const payload: JwtPayload = {
    userId: user._id.toString(),
    telegramId: user.telegramId,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const decoded = verifyToken(refreshToken);
  await redis.set(`refresh:${decoded.jti}`, user._id.toString(), 'EX', config.REFRESH_TOKEN_TTL);

  logger.info({ telegramId: tgUser.id }, 'User authenticated');

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      role: user.role,
    },
  };
}

/**
 * Refresh access token — rotates refresh token on use.
 */
export async function refreshAccessToken(refreshTokenStr: string): Promise<AuthTokens> {
  let decoded: ReturnType<typeof verifyToken>;
  try {
    decoded = verifyToken(refreshTokenStr);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const storedUserId = await redis.get(`refresh:${decoded.jti}`);
  if (!storedUserId) {
    throw new UnauthorizedError('Refresh token revoked or expired');
  }

  await redis.del(`refresh:${decoded.jti}`);

  const payload: JwtPayload = {
    userId: decoded.userId,
    telegramId: decoded.telegramId,
    role: decoded.role,
  };

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  const newDecoded = verifyToken(newRefreshToken);
  await redis.set(`refresh:${newDecoded.jti}`, decoded.userId, 'EX', config.REFRESH_TOKEN_TTL);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Logout — revoke both tokens.
 */
export async function logout(accessToken: string, refreshTokenStr: string): Promise<void> {
  try {
    const accessDecoded = verifyToken(accessToken);
    await blacklistToken(accessDecoded.jti, accessDecoded.exp);
  } catch { /* already expired */ }

  try {
    const refreshDecoded = verifyToken(refreshTokenStr);
    await redis.del(`refresh:${refreshDecoded.jti}`);
  } catch { /* already expired */ }
}
