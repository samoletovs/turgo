/**
 * Redis Data Cache Layer
 *
 * Generic cache-aside helper backed by the shared IORedis singleton.
 * Falls back transparently to the fetcher when Redis is unavailable.
 *
 * Usage:
 *   import { cachedQuery, invalidate } from "@/server/services/cache";
 *   const categories = await cachedQuery("cache:categories", 900, () => db.category.findMany(...));
 *   await invalidate("cache:categories");
 */

import { getRedis } from '@/lib/redis';

/**
 * Cache-aside wrapper: checks Redis first, falls back to `fetcher`, then
 * stores the result with an EX TTL.  Gracefully degrades when Redis is
 * unavailable — the fetcher always runs in that case.
 *
 * @param key         Redis key (e.g. "cache:categories")
 * @param ttlSeconds  Time-to-live in seconds
 * @param fetcher     Async function that produces the value on cache miss
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const redis = await getRedis();
    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    }

    const data = await fetcher();

    // Fire-and-forget SET — don't block the response
    const redis2 = await getRedis();
    if (redis2) {
      redis2.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch((err: unknown) => {
        console.warn(`[cache] Failed to SET ${key}:`, err);
      });
    }

    return data;
  } catch {
    // Redis error (parse / connection) — fall through to fetcher
    return fetcher();
  }
}

/**
 * Invalidate (delete) one or more cache keys.
 * Safe to call even when Redis is down.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  try {
    const redis = await getRedis();
    if (redis && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn('[cache] Invalidation failed:', err);
  }
}

// ── Well-known cache keys ────────────────────────────────────
export const CACHE_KEYS = {
  CATEGORIES: 'cache:categories',
  LOCATIONS: 'cache:locations',
  PLANS: 'cache:plans',
  FEATURED: 'cache:featured',
} as const;

// ── TTLs (seconds) ──────────────────────────────────────────
export const CACHE_TTL = {
  CATEGORIES: 15 * 60, // 15 min
  LOCATIONS: 15 * 60, // 15 min
  PLANS: 30 * 60, // 30 min
  FEATURED: 5 * 60, // 5 min
} as const;
