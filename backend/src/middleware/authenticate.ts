import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { redis } from '../infrastructure/redis.js';
import type { JwtPayload } from '../types/auth.types.js';
import { UnauthorizedError } from '../types/errors.js';

export type { JwtPayload };

/** Sign a new access token */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as string,
    jwtid: crypto.randomUUID(),
  } as jwt.SignOptions);
}

/** Sign a new refresh token */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.REFRESH_TOKEN_TTL,
    jwtid: crypto.randomUUID(),
  } as jwt.SignOptions);
}

/** Verify and decode JWT */
export function verifyToken(token: string): JwtPayload & { jti: string; exp: number } {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload & { jti: string; exp: number };
}

/** Fastify preHandler hook — verifies JWT */
export async function jwtAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing access token' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);

    const isBlacklisted = await redis.exists(`blacklist:${decoded.jti}`);
    if (isBlacklisted) {
      reply.code(401).send({ error: 'Token has been revoked' });
      return;
    }

    request.user = {
      userId: decoded.userId,
      telegramId: decoded.telegramId,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      reply.code(401).send({ error: 'Token expired' });
    } else {
      reply.code(401).send({ error: 'Invalid token' });
    }
  }
}

/** Blacklist an access token in Redis until its expiry */
export async function blacklistToken(jti: string, expSeconds: number): Promise<void> {
  const ttl = expSeconds - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
  }
}
