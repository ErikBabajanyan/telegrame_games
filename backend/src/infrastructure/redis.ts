import IORedis from 'ioredis';
const Redis = IORedis.default ?? IORedis;
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// ─── Connection Setup ───

function createRedisClient(): InstanceType<typeof Redis> {
  const clusterUrls = config.REDIS_CLUSTER_URLS;

  if (clusterUrls) {
    const nodes = clusterUrls.split(',').map((url) => {
      const parsed = new URL(url.trim());
      return { host: parsed.hostname, port: Number(parsed.port) || 6379 };
    });

    // @ts-expect-error Cluster constructor signature differs
    return new IORedis.Cluster(nodes, {
      redisOptions: {
        password: new URL(config.REDIS_URL).password || undefined,
        maxRetriesPerRequest: 3,
      },
      scaleReads: 'slave',
    });
  }

  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: true,
    enableReadyCheck: true,
  });
}

export const redis = createRedisClient();

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err: Error) => {
  logger.error(err, 'Redis connection error');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    logger.error(error, 'Redis connection failed');
    process.exit(1);
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected gracefully');
}

// ─── Atomic Lua Scripts ───

// Atomic bet deduction + mark dirty + track stats
export const DEDUCT_BET_SCRIPT = `
  local balance = tonumber(redis.call('GET', KEYS[1]))
  local bet = tonumber(ARGV[1])
  if not balance or balance < bet then
    return -1
  end
  redis.call('DECRBY', KEYS[1], bet)
  -- Mark balance dirty for sync
  local userId = ARGV[2]
  if userId then
    redis.call('SADD', 'balance:dirty', userId)
  end
  return balance - bet
`;

// Atomic balance credit + mark dirty + track stats
export const CREDIT_BALANCE_SCRIPT = `
  local balance = tonumber(redis.call('GET', KEYS[1]))
  if not balance then
    redis.call('SET', KEYS[1], ARGV[1])
    balance = 0
  else
    redis.call('INCRBY', KEYS[1], ARGV[1])
  end
  -- Mark balance dirty for sync
  local userId = ARGV[2]
  if userId then
    redis.call('SADD', 'balance:dirty', userId)
  end
  return balance + tonumber(ARGV[1])
`;

// ─── Real-time Game Stats Tracking (for luck factor) ───

/**
 * Track a bet result in Redis counters for real-time luck calculation.
 * Keys: stats:{userId}:bets, stats:{userId}:wins, stats:{userId}:totalBet, stats:{userId}:totalPayout
 * All keys expire after 25 hours (slightly longer than lookback window).
 */
export async function trackGameStats(
  userId: string,
  betAmount: number,
  payoutAmount: number,
  isWin: boolean,
  gameType: string,
): Promise<void> {
  const ttl = 25 * 60 * 60; // 25 hours
  const pipeline = redis.pipeline();

  // Global user stats
  pipeline.incr(`stats:${userId}:bets`);
  pipeline.expire(`stats:${userId}:bets`, ttl);
  pipeline.incrby(`stats:${userId}:totalBet`, betAmount);
  pipeline.expire(`stats:${userId}:totalBet`, ttl);
  pipeline.incrby(`stats:${userId}:totalPayout`, payoutAmount);
  pipeline.expire(`stats:${userId}:totalPayout`, ttl);

  if (isWin) {
    pipeline.incr(`stats:${userId}:wins`);
    pipeline.expire(`stats:${userId}:wins`, ttl);
  }

  // Per-game-type stats
  pipeline.incr(`stats:${userId}:${gameType}:bets`);
  pipeline.expire(`stats:${userId}:${gameType}:bets`, ttl);
  pipeline.incrby(`stats:${userId}:${gameType}:totalBet`, betAmount);
  pipeline.expire(`stats:${userId}:${gameType}:totalBet`, ttl);
  pipeline.incrby(`stats:${userId}:${gameType}:totalPayout`, payoutAmount);
  pipeline.expire(`stats:${userId}:${gameType}:totalPayout`, ttl);

  if (isWin) {
    pipeline.incr(`stats:${userId}:${gameType}:wins`);
    pipeline.expire(`stats:${userId}:${gameType}:wins`, ttl);
  }

  // Track net profit for real-time threshold check
  pipeline.incrby(`stats:${userId}:netProfit`, payoutAmount - betAmount);
  pipeline.expire(`stats:${userId}:netProfit`, ttl);

  await pipeline.exec();
}

/**
 * Read real-time stats from Redis counters (no MongoDB aggregation needed).
 */
export async function getRealtimeStats(userId: string, gameType?: string): Promise<{
  totalGames: number;
  wins: number;
  totalBet: number;
  totalPayout: number;
  netProfit: number;
}> {
  const prefix = gameType ? `stats:${userId}:${gameType}` : `stats:${userId}`;
  const pipeline = redis.pipeline();

  pipeline.get(`${prefix}:bets`);
  pipeline.get(`${prefix}:wins`);
  pipeline.get(`${prefix}:totalBet`);
  pipeline.get(`${prefix}:totalPayout`);
  pipeline.get(`stats:${userId}:netProfit`);

  const results = await pipeline.exec();

  return {
    totalGames: Number(results?.[0]?.[1] ?? 0),
    wins: Number(results?.[1]?.[1] ?? 0),
    totalBet: Number(results?.[2]?.[1] ?? 0),
    totalPayout: Number(results?.[3]?.[1] ?? 0),
    netProfit: Number(results?.[4]?.[1] ?? 0),
  };
}
