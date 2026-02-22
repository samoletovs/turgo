/**
 * View Counter Service
 *
 * Atomic, Redis-backed view counting with:
 * - Redis INCR for atomic counting (key: `views:listing:{id}`)
 * - Periodic flush to Prisma (every 60s or every 100 increments)
 * - Direct DB fallback when Redis is unavailable
 * - Bot/crawler User-Agent detection
 * - IP-based deduplication (one view per IP per listing per hour)
 */

import type IORedis from "ioredis";
import { db } from "@/server/db";

// ── Redis connection (lazy, shared) ──────────────────────────

let redis: IORedis | null = null;
let redisUnavailable = false;

async function getRedis(): Promise<IORedis | null> {
  if (redisUnavailable) return null;
  if (redis) return redis;

  try {
    const { default: Redis } = await import("ioredis");
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    return redis;
  } catch {
    console.warn("[view-counter] Redis unavailable — using direct DB fallback");
    redisUnavailable = true;
    return null;
  }
}

// ── Bot / Crawler Detection ──────────────────────────────────

const BOT_PATTERNS = [
  /bot\b/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /mediapartners/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /twitterbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /duckduckbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /dotbot/i,
  /rogerbot/i,
  /pingdom/i,
  /uptimerobot/i,
  /lighthouse/i,
  /chrome-lighthouse/i,
  /headlesschrome/i,
  /phantomjs/i,
  /prerender/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /go-http-client/i,
  /java\//i,
  /httpx/i,
  /scrapy/i,
];

function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // No UA = likely bot
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// ── Flush tracking ───────────────────────────────────────────

const FLUSH_INTERVAL_MS = 60_000; // 60 seconds
const FLUSH_THRESHOLD = 100; // flush after 100 accumulated increments

let pendingIncrements = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushToDatabase();
  }, FLUSH_INTERVAL_MS);

  // Don't hold the process open
  if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref();
  }
}

/**
 * Flush accumulated Redis view counts to the database.
 * Reads all `views:listing:*` keys, updates Prisma in batch,
 * then decrements Redis counts by the flushed amount.
 */
async function flushToDatabase(): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  try {
    // Find all pending view count keys
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        "MATCH",
        "views:listing:*",
        "COUNT",
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");

    if (keys.length === 0) return;

    // Read all counts atomically via pipeline
    const pipeline = client.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();
    if (!results) return;

    // Build batch updates
    const updates: { id: string; count: number }[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const [err, value] = results[i] ?? [null, null];
      if (err || !value) continue;

      const count = parseInt(value as string, 10);
      if (count <= 0 || isNaN(count)) continue;

      // Extract listing ID from key "views:listing:{id}"
      const listingId = key.replace("views:listing:", "");
      updates.push({ id: listingId, count });
    }

    if (updates.length === 0) return;

    // Batch update DB + decrement Redis in a pipeline
    const decrPipeline = client.pipeline();

    await Promise.all(
      updates.map(async ({ id, count }) => {
        try {
          await db.listing.update({
            where: { id },
            data: { viewCount: { increment: count } },
          });
          // Only decrement Redis after successful DB write
          decrPipeline.decrby(`views:listing:${id}`, count);
        } catch {
          // Listing may have been deleted — skip silently
          decrPipeline.del(`views:listing:${id}`);
        }
      }),
    );

    await decrPipeline.exec();
    pendingIncrements = 0;

    if (updates.length > 0) {
      console.log(
        `[view-counter] Flushed ${updates.reduce((s, u) => s + u.count, 0)} views across ${updates.length} listings`,
      );
    }
  } catch (error) {
    console.error("[view-counter] Flush failed:", error);
  }
}

// ── Public API ───────────────────────────────────────────────

export interface IncrementOptions {
  listingId: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Increment the view count for a listing.
 *
 * - Skips bots/crawlers based on User-Agent
 * - Deduplicates by IP (one view per IP per listing per hour)
 * - Uses Redis INCR with periodic DB flush
 * - Falls back to direct DB increment if Redis is unavailable
 */
export async function incrementViewCount({
  listingId,
  ip,
  userAgent,
}: IncrementOptions): Promise<void> {
  // 1. Bot detection — skip entirely
  if (isBot(userAgent)) return;

  const client = await getRedis();

  if (client) {
    try {
      // 2. IP deduplication — one view per IP per listing per hour
      if (ip) {
        const dedupeKey = `viewdedup:${listingId}:${ip}`;
        const alreadySeen = await client.set(dedupeKey, "1", "EX", 3600, "NX");
        // SET NX returns null if key already existed
        if (alreadySeen === null) return;
      }

      // 3. Atomic increment in Redis
      await client.incr(`views:listing:${listingId}`);

      // 4. Check if we should flush early (threshold reached)
      pendingIncrements++;
      ensureFlushTimer();

      if (pendingIncrements >= FLUSH_THRESHOLD) {
        // Fire-and-forget flush
        void flushToDatabase();
      }

      return;
    } catch (error) {
      console.warn("[view-counter] Redis error, falling back to DB:", error);
      // Fall through to direct DB update
    }
  }

  // Fallback: direct DB increment (no deduplication without Redis)
  try {
    await db.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Listing may not exist — ignore
  }
}

/**
 * Get the real-time view count for a listing (Redis + DB combined).
 * Useful for displaying accurate counts before a flush happens.
 */
export async function getViewCount(listingId: string): Promise<number> {
  // Get base count from DB
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { viewCount: true },
  });

  const dbCount = listing?.viewCount ?? 0;

  // Add pending Redis count
  const client = await getRedis();
  if (client) {
    try {
      const pending = await client.get(`views:listing:${listingId}`);
      return dbCount + (pending ? parseInt(pending, 10) : 0);
    } catch {
      return dbCount;
    }
  }

  return dbCount;
}

/**
 * Force flush all pending view counts to the database.
 * Call during graceful shutdown.
 */
export async function flushViewCounts(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushToDatabase();
}

// Export for testing
export { isBot as _isBot };
