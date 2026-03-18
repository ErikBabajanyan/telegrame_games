import { createHmac } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { TELEGRAM_HMAC_KEY } from '../types/constants.js';
import type { TelegramUser } from '../types/auth.types.js';

/**
 * Verify Telegram Mini App initData signature.
 */
export function verifyTelegramInitData(initData: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', TELEGRAM_HMAC_KEY)
    .update(config.BOT_TOKEN)
    .digest();

  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return expectedHash === hash;
}

/** Extract user data from validated initData */
export function parseTelegramUser(initData: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    const raw = JSON.parse(userStr) as Record<string, unknown>;
    return {
      id: raw.id as number,
      firstName: (raw.first_name ?? raw.firstName ?? 'Player') as string,
      lastName: (raw.last_name ?? raw.lastName) as string | undefined,
      username: raw.username as string | undefined,
      languageCode: (raw.language_code ?? raw.languageCode) as string | undefined,
    };
  } catch {
    return null;
  }
}

/** Fastify preHandler hook — validates Telegram initData */
export async function telegramAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('tma ')) {
    reply.code(401).send({ error: 'Missing Telegram initData' });
    return;
  }

  const initData = authHeader.slice(4);

  if (!verifyTelegramInitData(initData)) {
    reply.code(401).send({ error: 'Invalid Telegram initData signature' });
    return;
  }

  const user = parseTelegramUser(initData);
  if (!user) {
    reply.code(401).send({ error: 'Could not parse Telegram user data' });
    return;
  }

  request.telegramUser = user;
}
