import type { FastifyInstance } from 'fastify';
import { telegramAuthSchema, refreshTokenSchema } from './auth.schema.js';
import { authenticateWithTelegram, refreshAccessToken, logout } from './auth.service.js';
import { jwtAuthHook } from '../../middleware/authenticate.js';
import { AppError } from '../../types/errors.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /auth/telegram */
  app.post('/telegram', async (request, reply) => {
    const parsed = telegramAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    try {
      const result = await authenticateWithTelegram(parsed.data.initData);
      return reply.code(200).send(result);
    } catch (error) {
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(statusCode).send({ error: message });
    }
  });

  /** POST /auth/refresh */
  app.post('/refresh', async (request, reply) => {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    try {
      const tokens = await refreshAccessToken(parsed.data.refreshToken);
      return reply.code(200).send(tokens);
    } catch (error) {
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(statusCode).send({ error: message });
    }
  });

  /** POST /auth/logout */
  app.post('/logout', { preHandler: [jwtAuthHook] }, async (request, reply) => {
    const authHeader = request.headers.authorization ?? '';
    const accessToken = authHeader.slice(7);
    const body = request.body as { refreshToken?: string } | null;

    await logout(accessToken, body?.refreshToken ?? '');
    return reply.code(200).send({ message: 'Logged out' });
  });
}
