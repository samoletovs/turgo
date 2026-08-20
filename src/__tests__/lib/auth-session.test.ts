import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import { hasValidSession } from '@/lib/auth-session';

describe('auth session validation', () => {
  const user = {
    id: 'user-1',
    name: 'User',
    email: 'user@example.com',
    role: 'USER' as const,
    locale: 'en',
  };

  it('accepts a session with a user', () => {
    expect(hasValidSession({ user, expires: '2099-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('rejects null and errored sessions', () => {
    expect(hasValidSession(null)).toBe(false);
    expect(
      hasValidSession({
        user,
        expires: '2099-01-01T00:00:00.000Z',
        error: 'Configuration',
      }),
    ).toBe(false);
  });
});
