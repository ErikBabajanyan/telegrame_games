import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      telegramId: number;
      role: string;
    };
    telegramUser?: {
      id: number;
      firstName: string;
      lastName?: string;
      username?: string;
      languageCode?: string;
    };
  }
}
