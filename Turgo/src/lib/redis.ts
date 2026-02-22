/**
 * Shared Redis singleton — lazy connection to REDIS_URL
 *
 * Usage:
 *   import { getRedis, REDIS_URL } from "@/lib/redis";
 *   const client = await getRedis();   // IORedis instance | null
 *
 * BullMQ needs its own connection with `maxRetriesPerRequest: null`,
 * so import `REDIS_URL` and construct one directly.
 */

import type IORedis from "ioredis";

// ── Shared config ────────────────────────────────────────────
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── Singleton state ──────────────────────────────────────────
let redis: IORedis | null = null;
let redisUnavailable = false;

/**
 * Return the shared IORedis instance, or `null` when Redis is not
 * configured / not reachable.  The connection is created lazily on the
 * first call and reused afterwards.
 */
export async function getRedis(): Promise<IORedis | null> {
  if (redisUnavailable) return null;
  if (redis) return redis;

  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    return redis;
  } catch (err) {
    console.warn("[redis] Connection failed — Redis features disabled:", err);
    redisUnavailable = true;
    return null;
  }
}

// Re-export the type so consumers don't need a direct ioredis import
export type { IORedis };
