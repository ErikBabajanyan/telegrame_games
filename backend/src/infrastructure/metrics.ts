import { redis } from './redis.js';
import { logger } from '../utils/logger.js';

/**
 * Lightweight Redis-based metrics (no external deps).
 * Tracks counters and histograms using Redis INCR/HSET.
 * Exposes /metrics endpoint in Prometheus text format.
 */

const METRICS_PREFIX = 'metrics:';

// ─── Counter Operations ───

export async function incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): Promise<void> {
  const key = `${METRICS_PREFIX}counter:${name}`;
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
  const field = labelStr || '__total__';
  await redis.hincrby(key, field, value).catch((err) => {
    logger.debug({ err, name }, 'Metrics increment failed (non-critical)');
  });
}

// ─── Histogram (simple bucket-based) ───

export async function observeHistogram(name: string, valueMs: number, labels: Record<string, string> = {}): Promise<void> {
  const bucket = getBucket(valueMs);
  const key = `${METRICS_PREFIX}histogram:${name}`;
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
  const field = labelStr ? `${labelStr},le="${bucket}"` : `le="${bucket}"`;
  const sumField = labelStr ? `${labelStr},__sum__` : '__sum__';
  const countField = labelStr ? `${labelStr},__count__` : '__count__';

  const pipeline = redis.pipeline();
  pipeline.hincrby(key, field, 1);
  pipeline.hincrbyfloat(key, sumField, valueMs);
  pipeline.hincrby(key, countField, 1);
  await pipeline.exec();
}

function getBucket(ms: number): string {
  const buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  for (const b of buckets) {
    if (ms <= b) return String(b);
  }
  return '+Inf';
}

// ─── Gauge Operations ───

export async function setGauge(name: string, value: number, labels: Record<string, string> = {}): Promise<void> {
  const key = `${METRICS_PREFIX}gauge:${name}`;
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
  const field = labelStr || '__value__';
  await redis.hset(key, field, value.toString()).catch((err) => {
    logger.debug({ err, name }, 'Metrics gauge set failed (non-critical)');
  });
}

// ─── Prometheus Export ───

export async function getPrometheusMetrics(): Promise<string> {
  const lines: string[] = [];

  // Counters
  const counterKeys = await scanKeys(`${METRICS_PREFIX}counter:*`);
  for (const key of counterKeys) {
    const name = key.replace(`${METRICS_PREFIX}counter:`, '');
    const fields = await redis.hgetall(key);
    lines.push(`# TYPE ${name} counter`);
    for (const [labels, value] of Object.entries(fields)) {
      if (labels === '__total__') {
        lines.push(`${name} ${value}`);
      } else {
        lines.push(`${name}{${labels}} ${value}`);
      }
    }
  }

  // Gauges
  const gaugeKeys = await scanKeys(`${METRICS_PREFIX}gauge:*`);
  for (const key of gaugeKeys) {
    const name = key.replace(`${METRICS_PREFIX}gauge:`, '');
    const fields = await redis.hgetall(key);
    lines.push(`# TYPE ${name} gauge`);
    for (const [labels, value] of Object.entries(fields)) {
      if (labels === '__value__') {
        lines.push(`${name} ${value}`);
      } else {
        lines.push(`${name}{${labels}} ${value}`);
      }
    }
  }

  // Histograms
  const histKeys = await scanKeys(`${METRICS_PREFIX}histogram:*`);
  for (const key of histKeys) {
    const name = key.replace(`${METRICS_PREFIX}histogram:`, '');
    const fields = await redis.hgetall(key);
    lines.push(`# TYPE ${name} histogram`);
    for (const [labels, value] of Object.entries(fields)) {
      if (labels.includes('__sum__')) {
        const prefix = labels.replace(',__sum__', '').replace('__sum__', '');
        lines.push(prefix ? `${name}_sum{${prefix}} ${value}` : `${name}_sum ${value}`);
      } else if (labels.includes('__count__')) {
        const prefix = labels.replace(',__count__', '').replace('__count__', '');
        lines.push(prefix ? `${name}_count{${prefix}} ${value}` : `${name}_count ${value}`);
      } else {
        lines.push(`${name}_bucket{${labels}} ${value}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

// ─── Pre-defined metric helpers ───

export const gameMetrics = {
  betPlaced: (gameType: string, amount: number) =>
    incrementCounter('game_bets_total', { game: gameType }).then(() =>
      incrementCounter('game_bet_volume_nano', { game: gameType }, amount)),

  gameWon: (gameType: string, payout: number) =>
    incrementCounter('game_wins_total', { game: gameType }).then(() =>
      incrementCounter('game_payout_volume_nano', { game: gameType }, payout)),

  gameLost: (gameType: string) =>
    incrementCounter('game_losses_total', { game: gameType }),

  betLatency: (gameType: string, ms: number) =>
    observeHistogram('game_bet_duration_ms', ms, { game: gameType }),

  activeGames: (gameType: string, count: number) =>
    setGauge('game_active_sessions', count, { game: gameType }),

  wsConnections: (count: number) =>
    setGauge('websocket_connections', count),

  balanceSyncLag: (ms: number) =>
    setGauge('balance_sync_lag_ms', ms),

  luckRecalcDuration: (ms: number) =>
    observeHistogram('luck_recalc_duration_ms', ms),

  mongoWriteRetry: (collection: string) =>
    incrementCounter('mongo_write_retries_total', { collection }),

  mongoWriteFailed: (collection: string) =>
    incrementCounter('mongo_write_failures_total', { collection }),
};
