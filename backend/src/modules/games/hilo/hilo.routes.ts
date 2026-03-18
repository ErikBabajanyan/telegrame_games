import type { FastifyInstance } from 'fastify';
import { jwtAuthHook } from '../../../middleware/authenticate.js';
import { betRateLimit, defaultRateLimit } from '../../../middleware/rateLimit.js';
import { startGame, makeGuess, skipCard, cashOut, getActiveGame, getGameHistory } from './hilo.service.js';
import { AppError } from '../../../types/errors.js';
import { z } from 'zod';

const startSchema = z.object({ betAmount: z.number().int().positive() });
const guessSchema = z.object({ gameId: z.string().min(1), guess: z.enum(['higher', 'lower']) });
const gameIdSchema = z.object({ gameId: z.string().min(1) });
const historyQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

function handleError(error: unknown, reply: { code: (n: number) => { send: (b: Record<string, unknown>) => void } }) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Internal server error';
  return reply.code(statusCode).send({ error: message });
}

export async function hiloRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', jwtAuthHook);

  /** GET /games/hilo/active */
  app.get('/active', async (request, reply) => {
    try {
      const game = await getActiveGame(request.user!.userId);
      if (!game) return reply.code(200).send({ active: false });
      return reply.code(200).send({ active: true, game });
    } catch (error) { return handleError(error, reply); }
  });

  /** POST /games/hilo/start */
  app.post('/start', { preHandler: [betRateLimit] }, async (request, reply) => {
    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await startGame(request.user!.userId, parsed.data.betAmount));
    } catch (error) { return handleError(error, reply); }
  });

  /** POST /games/hilo/guess */
  app.post('/guess', { preHandler: [betRateLimit] }, async (request, reply) => {
    const parsed = guessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await makeGuess(request.user!.userId, parsed.data.gameId, parsed.data.guess));
    } catch (error) { return handleError(error, reply); }
  });

  /** POST /games/hilo/skip */
  app.post('/skip', async (request, reply) => {
    const parsed = gameIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await skipCard(request.user!.userId, parsed.data.gameId));
    } catch (error) { return handleError(error, reply); }
  });

  /** POST /games/hilo/cashout */
  app.post('/cashout', async (request, reply) => {
    const parsed = gameIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await cashOut(request.user!.userId, parsed.data.gameId));
    } catch (error) { return handleError(error, reply); }
  });

  /** GET /games/hilo/history */
  app.get('/history', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    const parsed = historyQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await getGameHistory(request.user!.userId, parsed.data.page, parsed.data.limit));
    } catch (error) { return handleError(error, reply); }
  });
}
