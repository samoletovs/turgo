/**
 * Rate Limiter — Redis-based sliding window with in-memory fallback
 *
 * Uses sorted sets (ZADD + ZREMRANGEBYSCORE + ZCARD) inside a
 * MULTI/EXEC pipeline for an atomic sliding-window counter.
 * Falls back to an in-memory Map when Redis is unavailable.
 */

import { getRedis } from '@/lib/redis';

// ── In-memory fallback ───────────────────────────────────────

interface MemoryEntry {
  timestamps: number[];
}

const store = new Map<string, MemoryEntry>();

// Cleanup stale entries every 60 s
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > now - 3_600_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the Node process to exit naturally
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; reset: number } {
  ensureCleanup();

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const count = entry.timestamps.length;

  if (count >= limit) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    return {
      success: false,
      remaining: 0,
      reset: oldestInWindow + windowMs,
    };
  }

  entry.timestamps.push(now);

  return {
    success: true,
    remaining: limit - count - 1,
    reset: now + windowMs,
  };
}

// ── Public API ───────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Unix-ms timestamp when the window resets */
  reset: number;
}

/**
 * Check and record a rate-limit hit.
 *
 * @param key      Unique key (e.g. `listing:create:<userId>`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const client = await getRedis();

  // Fallback to in-memory when Redis is not available
  if (!client) {
    return memoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const pipeline = client.multi();
    // 1. Remove entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    // 2. Add current timestamp with score = now, member = unique id
    pipeline.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
    // 3. Count entries in the window
    pipeline.zcard(redisKey);
    // 4. Set key expiry so Redis auto-cleans
    pipeline.pexpire(redisKey, windowMs);

    const results = await pipeline.exec();

    // results is an array of [error, result] tuples
    if (!results) {
      return memoryRateLimit(key, limit, windowMs);
    }

    const count = (results[2]?.[1] as number) ?? 0;

    if (count > limit) {
      // Over limit — remove the entry we just added and deny
      return {
        success: false,
        remaining: 0,
        reset: now + windowMs,
      };
    }

    return {
      success: true,
      remaining: limit - count,
      reset: now + windowMs,
    };
  } catch (err) {
    console.warn('[rate-limit] Redis error, falling back to memory:', err);
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Helper for Next.js API route handlers that extracts a client IP.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}
