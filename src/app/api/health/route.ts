import { NextResponse } from 'next/server';

interface ServiceStatus {
  status: 'ok' | 'error' | 'unavailable';
  latencyMs?: number;
  message?: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const { db } = await import('@/server/db');
    await db.$queryRawUnsafe('SELECT 1');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    await redis.disconnect();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkMeilisearch(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const url = process.env.MEILISEARCH_URL || 'http://localhost:7700';
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'error', latencyMs: Date.now() - start, message: `HTTP ${res.status}` };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkBullMQ(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // BullMQ depends on Redis, so we check the connection
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    const pong = await redis.ping();
    await redis.disconnect();
    return {
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const startTime = Date.now();

  const [database, redis, meilisearch, bullmq] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkMeilisearch(),
    checkBullMQ(),
  ]);

  const services = {
    database:
      database.status === 'fulfilled'
        ? database.value
        : { status: 'error' as const, message: 'Check failed' },
    redis:
      redis.status === 'fulfilled'
        ? redis.value
        : { status: 'error' as const, message: 'Check failed' },
    meilisearch:
      meilisearch.status === 'fulfilled'
        ? meilisearch.value
        : { status: 'error' as const, message: 'Check failed' },
    bullmq:
      bullmq.status === 'fulfilled'
        ? bullmq.value
        : { status: 'error' as const, message: 'Check failed' },
  };

  const allHealthy = Object.values(services).every((s) => s.status === 'ok');

  const response = {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    totalLatencyMs: Date.now() - startTime,
    version: process.env.npm_package_version || '0.1.0',
    services,
  };

  return NextResponse.json(response, {
    status: allHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
