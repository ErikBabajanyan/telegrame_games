import type { FastifyInstance } from 'fastify';
import { jwtAuthHook } from '../../../middleware/authenticate.js';
import { betRateLimit, defaultRateLimit } from '../../../middleware/rateLimit.js';
import { roll, getGameHistory } from './dice.service.js';
import { AppError } from '../../../types/errors.js';
import { z } from 'zod';

const rollSchema = z.object({
  betAmount: z.number().int().positive(),
  target: z.number().int().min(2).max(98),
  mode: z.enum(['under', 'over']),
});

const historyQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

function handleError(error: unknown, reply: { code: (n: number) => { send: (b: Record<string, unknown>) => void } }) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Internal server error';
  return reply.code(statusCode).send({ error: message });
}

export async function diceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', jwtAuthHook);

  /** POST /games/dice/roll — atomic: bet + roll + result in one request */
  app.post('/roll', { preHandler: [betRateLimit] }, async (request, reply) => {
    const parsed = rollSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await roll({
        userId: request.user!.userId,
        betAmount: parsed.data.betAmount,
        target: parsed.data.target,
        mode: parsed.data.mode,
      }));
    } catch (error) { return handleError(error, reply); }
  });

  /** GET /games/dice/history */
  app.get('/history', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    const parsed = historyQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await getGameHistory(request.user!.userId, parsed.data.page, parsed.data.limit));
    } catch (error) { return handleError(error, reply); }
  });
}
