import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disablePush, enablePush, type PushSubscriptionApi } from '@/lib/push-subscription';

const subscription = {
  endpoint: 'https://fcm.googleapis.com/token',
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/token',
    keys: { p256dh: 'public-key', auth: 'auth-key' },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};
const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};
const registration = { pushManager } as unknown as ServiceWorkerRegistration;
const requestPermission = vi.fn();
let api: PushSubscriptionApi;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('Notification', { requestPermission });
  requestPermission.mockResolvedValue('granted');
  pushManager.getSubscription.mockResolvedValue(null);
  pushManager.subscribe.mockResolvedValue(subscription);
  api = {
    getKey: vi.fn().mockResolvedValue('BAEC'),
    register: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => vi.unstubAllGlobals());

describe('browser subscription lifecycle', () => {
  it('requests permission and registers the browser subscription', async () => {
    await enablePush(registration, api);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([4, 1, 2]),
    });
    expect(api.register).toHaveBeenCalledWith({
      endpoint: subscription.endpoint,
      p256dh: 'public-key',
      auth: 'auth-key',
    });
  });

  it('does not subscribe or persist if the user denies permission', async () => {
    requestPermission.mockResolvedValue('denied');
    await expect(enablePush(registration, api)).rejects.toThrow('permission');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('does not subscribe when VAPID is unconfigured', async () => {
    vi.mocked(api.getKey).mockResolvedValue('');
    await expect(enablePush(registration, api)).rejects.toThrow('not configured');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('reuses an existing subscription', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription);
    await enablePush(registration, api);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.register).toHaveBeenCalledOnce();
  });

  it('rolls back a newly created subscription when persistence fails', async () => {
    vi.mocked(api.register).mockRejectedValue(new Error('Offline'));
    await expect(enablePush(registration, api)).rejects.toThrow('Offline');
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it('removes from the server before unsubscribing the browser', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription);
    await disablePush(registration, api);
    expect(api.remove).toHaveBeenCalledWith(subscription.endpoint);
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.mocked(api.remove).mock.invocationCallOrder[0]).toBeLessThan(
      subscription.unsubscribe.mock.invocationCallOrder[0],
    );
  });

  it('preserves the subscription for retry if removal fails', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription);
    vi.mocked(api.remove).mockRejectedValue(new Error('Offline'));
    await expect(disablePush(registration, api)).rejects.toThrow('Offline');
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('can disable repeatedly without a subscription', async () => {
    await disablePush(registration, api);
    expect(api.remove).not.toHaveBeenCalled();
  });
});
