import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb } from '@/__tests__/setup';
import { db } from '@/server/db';
import { createCallerFactory } from '@/server/trpc';
import { notificationRouter } from '@/server/trpc/routers/notification';

vi.mock('@/server/socket', () => ({ emitNotification: vi.fn() }));
vi.mock('@/server/services/email', () => ({ sendEmail: vi.fn() }));

const createCaller = createCallerFactory(notificationRouter);
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/browser-token',
  p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'),
  auth: Buffer.alloc(16, 2).toString('base64url'),
};

function caller(userId: string | null = 'user-1') {
  return createCaller({
    db,
    session: userId
      ? { user: { id: userId, email: 'test@example.com', role: 'USER', locale: 'en' }, expires: '' }
      : null,
    headers: new Headers(),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('push subscription endpoints', () => {
  it('rejects unauthenticated registration, removal and key requests', async () => {
    await expect(caller(null).registerPush(subscription)).rejects.toThrow('UNAUTHORIZED');
    await expect(caller(null).removePush({ endpoint: subscription.endpoint })).rejects.toThrow(
      'UNAUTHORIZED',
    );
    await expect(caller(null).getVapidKey()).rejects.toThrow('UNAUTHORIZED');
    expect(mockDb.pushSubscription.upsert).not.toHaveBeenCalled();
    expect(mockDb.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('atomically registers or refreshes the endpoint for the authenticated account', async () => {
    await expect(caller().registerPush(subscription)).resolves.toEqual({ success: true });
    expect(mockDb.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint },
      create: { ...subscription, userId: 'user-1' },
      update: { userId: 'user-1', p256dh: subscription.p256dh, auth: subscription.auth },
    });
    await caller('user-2').registerPush(subscription);
    expect(mockDb.pushSubscription.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ userId: 'user-2' }) }),
    );
  });

  it('removes only the current account subscription and is idempotent', async () => {
    await caller().removePush({ endpoint: subscription.endpoint });
    await caller().removePush({ endpoint: subscription.endpoint });
    expect(mockDb.pushSubscription.deleteMany).toHaveBeenLastCalledWith({
      where: { userId: 'user-1', endpoint: subscription.endpoint },
    });
  });

  it.each([
    'not-a-url',
    'http://fcm.googleapis.com/send/token',
    'https://127.0.0.1/push',
    'https://fcm.googleapis.com.evil.example/push',
    'https://user@fcm.googleapis.com/push',
    'https://fcm.googleapis.com:8443/push',
  ])('rejects unsafe push destination %s', async (endpoint) => {
    await expect(caller().registerPush({ ...subscription, endpoint })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockDb.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { p256dh: '' },
    { auth: 'not-a-key' },
    { p256dh: Buffer.alloc(65, 1).toString('base64url') },
  ])('rejects invalid key material %j', async (keys) => {
    await expect(caller().registerPush({ ...subscription, ...keys })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it.each([
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://wns2.notify.windows.com/w/?token',
    'https://web.push.apple.com/token',
  ])('accepts supported browser push provider %s', async (endpoint) => {
    await expect(caller().registerPush({ ...subscription, endpoint })).resolves.toEqual({
      success: true,
    });
  });
});
