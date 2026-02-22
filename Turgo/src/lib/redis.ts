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
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** How long to wait before retrying a failed Redis connection (ms). */
const RETRY_INTERVAL_MS = 60_000;

/**
 * Schedule a one-shot retry that clears the `redisUnavailable` flag so the
 * next `getRedis()` call will attempt to reconnect.
 */
function scheduleRetry() {
  if (retryTimer) return; // already scheduled
  retryTimer = setTimeout(() => {
    retryTimer = null;
    redisUnavailable = false;
    redis = null;
    console.info(
      "[redis] Retry window opened — next call will attempt reconnect.",
    );
  }, RETRY_INTERVAL_MS);
}

/**
 * Return the shared IORedis instance, or `null` when Redis is not
 * configured / not reachable.  The connection is created lazily on the
 * first call and reused afterwards.  On failure the connection is retried
 * after RETRY_INTERVAL_MS instead of being permanently disabled.
 */
export async function getRedis(): Promise<IORedis | null> {
  if (redisUnavailable) return null;
  if (redis) return redis;

  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: () => null, // don't auto-retry — we handle it ourselves
      lazyConnect: true,
    });

    // Swallow connection errors so Node doesn't crash with
    // "Unhandled error event" when Redis is unreachable.
    client.on("error", (err) => {
      console.warn("[redis] Connection error (suppressed):", err.message);
    });

    await client.connect();
    redis = client;
    return redis;
  } catch (err) {
    console.warn(
      "[redis] Connection failed — Redis features disabled for 60 s:",
      err,
    );
    redisUnavailable = true;
    scheduleRetry();
    return null;
  }
}

// Re-export the type so consumers don't need a direct ioredis import
export type { IORedis };
