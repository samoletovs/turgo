/**
 * Tests for src/lib/rate-limit.ts
 *
 * These tests exercise the in-memory fallback path (no Redis required).
 * The module is imported WITHOUT the global mock so we test the real logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Bypass the global mock for this test file — import the real implementation
vi.unmock('@/lib/rate-limit');
// Mock ioredis so the module doesn't try to connect to a real server
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      throw new Error('Redis not available in test');
    }),
  };
});

// Dynamic import so our mocks take effect first
const { rateLimit, getClientIp } = await import('@/lib/rate-limit');

describe('rateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    // Reset the internal store between tests by requesting a unique key prefix
  });

  it('allows requests under the limit', async () => {
    const key = `test-allow-${Date.now()}`;
    const result = await rateLimit({ key, limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.reset).toBeGreaterThan(Date.now() - 1000);
  });

  it('counts multiple requests and decrements remaining', async () => {
    const key = `test-count-${Date.now()}`;
    const r1 = await rateLimit({ key, limit: 3, windowMs: 60_000 });
    const r2 = await rateLimit({ key, limit: 3, windowMs: 60_000 });
    const r3 = await rateLimit({ key, limit: 3, windowMs: 60_000 });

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);

    // All should succeed
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });

  it('denies requests over the limit', async () => {
    const key = `test-deny-${Date.now()}`;
    await rateLimit({ key, limit: 2, windowMs: 60_000 });
    await rateLimit({ key, limit: 2, windowMs: 60_000 });
    const r3 = await rateLimit({ key, limit: 2, windowMs: 60_000 });

    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets after the window expires', async () => {
    vi.useFakeTimers();
    const key = `test-reset-${Date.now()}`;

    await rateLimit({ key, limit: 1, windowMs: 1_000 });
    const denied = await rateLimit({ key, limit: 1, windowMs: 1_000 });
    expect(denied.success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1_100);
    const allowed = await rateLimit({ key, limit: 1, windowMs: 1_000 });
    expect(allowed.success).toBe(true);

    vi.useRealTimers();
  });

  it('tracks different keys independently', async () => {
    const keyA = `test-indep-a-${Date.now()}`;
    const keyB = `test-indep-b-${Date.now()}`;

    await rateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
    const deniedA = await rateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
    const allowedB = await rateLimit({ key: keyB, limit: 1, windowMs: 60_000 });

    expect(deniedA.success).toBe(false);
    expect(allowedB.success).toBe(true);
  });

  it('provides a future reset timestamp', async () => {
    const key = `test-timestamp-${Date.now()}`;
    const result = await rateLimit({ key, limit: 10, windowMs: 5_000 });
    expect(result.reset).toBeGreaterThan(Date.now());
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 5_001);
  });
});

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});
