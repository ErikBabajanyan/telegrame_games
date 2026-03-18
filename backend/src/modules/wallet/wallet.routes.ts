import type { FastifyInstance } from 'fastify';
import { jwtAuthHook } from '../../middleware/authenticate.js';
import { defaultRateLimit, withdrawalRateLimit } from '../../middleware/rateLimit.js';
import { getBalance, verifyDeposit, requestWithdrawal, getTransactions } from './wallet.service.js';
import { AppError } from '../../types/errors.js';
import { z } from 'zod';

const depositVerifySchema = z.object({ txHash: z.string().min(1) });
const withdrawSchema = z.object({ amount: z.number().int().positive(), toAddress: z.string().min(1) });
const txHistoryQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['deposit', 'withdrawal', 'bet', 'win', 'refund']).optional(),
});

function handleError(error: unknown, reply: { code: (n: number) => { send: (b: Record<string, unknown>) => void } }) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Internal server error';
  return reply.code(statusCode).send({ error: message });
}

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', jwtAuthHook);

  app.get('/balance', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    try {
      return reply.code(200).send(await getBalance(request.user!.userId));
    } catch (error) { return handleError(error, reply); }
  });

  app.post('/deposit/verify', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    const parsed = depositVerifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await verifyDeposit(request.user!.userId, parsed.data.txHash));
    } catch (error) { return handleError(error, reply); }
  });

  app.post('/withdraw', { preHandler: [withdrawalRateLimit] }, async (request, reply) => {
    const parsed = withdrawSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await requestWithdrawal(request.user!.userId, parsed.data.amount, parsed.data.toAddress));
    } catch (error) { return handleError(error, reply); }
  });

  app.get('/transactions', { preHandler: [defaultRateLimit] }, async (request, reply) => {
    const parsed = txHistoryQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    try {
      return reply.code(200).send(await getTransactions(request.user!.userId, parsed.data.page, parsed.data.limit, parsed.data.type));
    } catch (error) { return handleError(error, reply); }
  });
}
