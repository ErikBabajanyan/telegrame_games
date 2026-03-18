import type { FastifyInstance } from 'fastify';
import { jwtAuthHook } from '../../../middleware/authenticate.js';
import { betRateLimit, defaultRateLimit } from '../../../middleware/rateLimit.js';
import { startGame, revealCell, cashOut, getActiveGame, getGameHistory } from './mines.service.js';
import { AppError } from '../../../types/errors.js';
import { z } from 'zod';

const startSchema = z.object({
  betAmount: z.number().int().positive(),
  mineCount: z.number().int().positive(),
});

const revealSchema = z.object({
  gameId: z.string().min(1),
  cellIndex: z.number().int().min(0).max(24),
});

const cashoutSchema = z.object({
  gameId: z.string().min(1),
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

export async function minesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', jwtAuthHook);

  /** GET /games/mines/active */
  app.get('/active', async (request, reply) => {
    try {
      const activeGame = await getActiveGame(request.user!.userId);
      if (!activeGame) return reply.code(200).send({ active: false });
      return reply.code(200).send({ active: true, game: activeGame });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /** POST /games/mines/start */
  app.post('/start', { preHandler: [betRateLimit] }, async (request, reply) => {
    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

    try {
      const result = await startGame({ userId: request.user!.userId, betAmount: parsed.data.betAmount, mineCount: parsed.data.mineCount });
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /** POST /games/mines/reveal */
  app.post('/reveal', { preHandler: [betRateLimit] }, async (request, reply) => {
    const parsed = revealSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

    try {
      const result = await revealCell({ userId: request.user!.userId, gameId: parsed.data.gameId, cellIndex: parsed.data.cellIndex });
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /** POST /games/mines/cashout */
  app.post('/cashout', async (request, reply) => {
    const parsed = cashoutSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

    try {
      const result = await cashOut(request.user!.userId, parsed.data.gameId);
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /** GET /games/mines/history */
  app.get('/history', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    const parsed = historyQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });

    try {
      const result = await getGameHistory(request.user!.userId, parsed.data.page, parsed.data.limit);
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
