import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/ton_casino'),
  MONGODB_POOL_SIZE: z.coerce.number().default(50),
  MONGODB_QUERY_TIMEOUT_MS: z.coerce.number().default(10_000),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_CLUSTER_URLS: z.string().default(''),  // comma-separated for cluster mode

  // Telegram Bot
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.coerce.number().default(2592000), // 30 days in seconds

  // TON
  ESCROW_CONTRACT_ADDRESS: z.string().default(''),
  TON_API_KEY: z.string().default(''),

  // Workers
  WITHDRAWAL_CONCURRENCY: z.coerce.number().default(10),
  BALANCE_SYNC_BATCH_SIZE: z.coerce.number().default(200),

  // Metrics
  METRICS_ENABLED: z.coerce.boolean().default(true),
});

type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config: EnvConfig = parsed.data;
