import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { isSearchHealthy } from '@/server/services/search';

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
  } catch {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: 'Database check failed',
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  let redis: Redis | undefined;
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      commandTimeout: 3000,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: 'Redis check failed',
    };
  } finally {
    redis?.disconnect();
  }
}

async function checkAzureSearch(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    if (await isSearchHealthy()) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
  } catch {
    // Health responses are public; never return SDK errors or request credentials.
  }
  return {
    status: 'error',
    latencyMs: Date.now() - start,
    message: 'Azure AI Search check failed',
  };
}

async function checkBullMQ(): Promise<ServiceStatus> {
  const start = Date.now();
  let redis: Redis | undefined;
  try {
    // BullMQ depends on Redis, so we check the connection
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      commandTimeout: 3000,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    await redis.connect();
    const pong = await redis.ping();
    return {
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: 'Queue check failed',
    };
  } finally {
    redis?.disconnect();
  }
}

export async function GET() {
  const startTime = Date.now();

  const [database, redis, azureSearch, bullmq] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkAzureSearch(),
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
    azureSearch:
      azureSearch.status === 'fulfilled'
        ? azureSearch.value
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
