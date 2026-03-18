import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../infrastructure/redis.js';
import type { RateLimitConfig } from '../types/wallet.types.js';
import { RATE_LIMIT_BET, RATE_LIMIT_WITHDRAWAL, RATE_LIMIT_DEFAULT } from '../types/constants.js';

/**
 * Create a rate limiter preHandler hook.
 * Uses Redis sliding window counter per user per route.
 */
export function createRateLimiter(rateConfig: RateLimitConfig) {
  return async function rateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user?.userId) return;

    const key = `ratelimit:${request.user.userId}:${request.routeOptions.url}`;
    const now = Date.now();
    const windowStart = now - rateConfig.windowSeconds * 1000;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), now.toString());
    pipeline.zcard(key);
    pipeline.expire(key, rateConfig.windowSeconds);

    const results = await pipeline.exec();
    const requestCount = results?.[2]?.[1] as number;

    if (requestCount > rateConfig.max) {
      reply.code(429).send({
        error: 'Too many requests',
        retryAfter: rateConfig.windowSeconds,
      });
      return;
    }

    reply.header('X-RateLimit-Limit', rateConfig.max);
    reply.header('X-RateLimit-Remaining', Math.max(0, rateConfig.max - requestCount));
  };
}

export const betRateLimit = createRateLimiter(RATE_LIMIT_BET);
export const withdrawalRateLimit = createRateLimiter(RATE_LIMIT_WITHDRAWAL);
export const defaultRateLimit = createRateLimiter(RATE_LIMIT_DEFAULT);
