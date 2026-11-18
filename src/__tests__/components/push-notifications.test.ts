// @vitest-environment jsdom

import { act, createElement, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-a' as string | null,
  register: vi.fn(),
  remove: vi.fn(),
  getKey: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  useSession: () => ({
    data: mocks.userId ? { user: { id: mocks.userId } } : null,
    status: mocks.userId ? 'authenticated' : 'unauthenticated',
  }),
}));

vi.mock('@/lib/trpc/client', () => ({
  TRPCProvider: ({ children }: { children: ReactNode }) => children,
  trpcClient: {
    notification: {
      getVapidKey: { query: mocks.getKey },
      registerPush: { mutate: mocks.register },
      removePush: { mutate: mocks.remove },
    },
  },
}));

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/socket-client', () => ({
  SocketProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/messaging/message-notification-toaster', () => ({
  MessageNotificationToaster: () => null,
}));
vi.mock('sonner', () => ({ Toaster: () => null }));

import { usePushNotifications } from '@/components/push-notifications';
import { Providers } from '@/components/providers';

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof usePushNotifications> | undefined;

function Probe() {
  const value = usePushNotifications();
  useEffect(() => {
    state = value;
  }, [value]);
  return null;
}

function currentState() {
  if (!state) throw new Error('Missing push context');
  return state;
}

async function render() {
  await act(async () => {
    root.render(createElement(Providers, null, createElement(Probe)));
  });
}

const subscription = {
  endpoint: 'https://fcm.googleapis.com/browser',
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/browser',
    keys: { p256dh: 'public', auth: 'auth' },
  }),
  unsubscribe: vi.fn(),
};
let subscribed = true;
const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};
const registerWorker = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  state = undefined;
  mocks.userId = 'user-a';
  mocks.register.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.getKey.mockResolvedValue({ key: 'BAEC' });
  registerWorker.mockResolvedValue(undefined);
  subscribed = true;
  subscription.unsubscribe.mockImplementation(async () => {
    subscribed = false;
    return true;
  });
  pushManager.getSubscription.mockImplementation(async () => (subscribed ? subscription : null));
  pushManager.subscribe.mockImplementation(async () => {
    subscribed = true;
    return subscription;
  });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: registerWorker,
      ready: Promise.resolve({
        pushManager,
      }),
    },
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Notification', {
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('push session reconciliation', () => {
  it('finishes previous registration and invalidates delivery before the next account opts in', async () => {
    let finishPrevious: (() => void) | undefined;
    let owner: string | null = null;
    mocks.register.mockImplementationOnce(() => {
      const requestUser = mocks.userId;
      return new Promise<void>((resolve) => {
        finishPrevious = () => {
          owner = requestUser;
          resolve();
        };
      });
    });
    mocks.register.mockImplementationOnce(async () => {
      owner = mocks.userId;
    });

    await render();
    await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    mocks.userId = 'user-b';
    await render();
    expect(mocks.register).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishPrevious?.();
    });
    expect(currentState()).toMatchObject({ enabled: false, available: true });
    expect(subscribed).toBe(false);
    await act(async () => currentState().setEnabled(true));
    expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(owner).toBe('user-b');
    expect(currentState().enabled).toBe(true);
  });

  it('cancels a delayed enable across sign-out/sign-in through the real provider tree', async () => {
    subscribed = false;
    let finishKeyRequest: (() => void) | undefined;
    mocks.getKey.mockImplementationOnce(
      () =>
        new Promise<{ key: string }>((resolve) => {
          finishKeyRequest = () => resolve({ key: 'BAEC' });
        }),
    );
    await render();
    let operation: Promise<void> | undefined;
    await act(async () => {
      operation = currentState().setEnabled(true);
    });

    expect(mocks.getKey).toHaveBeenCalledOnce();
    mocks.userId = null;
    await render();
    mocks.userId = 'user-b';
    await render();
    await act(async () => {
      finishKeyRequest?.();
      await operation;
    });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(subscribed).toBe(false);
    expect(currentState()).toMatchObject({ enabled: false, available: true });
  });

  it('preserves account cleanup while initial worker registration is pending', async () => {
    let finishRegistration: (() => void) | undefined;
    registerWorker.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRegistration = resolve;
        }),
    );
    await render();
    expect(registerWorker).toHaveBeenCalledOnce();
    mocks.userId = null;
    await render();
    mocks.userId = 'user-b';
    await render();
    await act(async () => {
      finishRegistration?.();
    });

    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(subscribed).toBe(false);
    expect(currentState()).toMatchObject({ enabled: false, available: true });
  });

  it('keeps active browser controls usable after temporary reconciliation failure', async () => {
    mocks.register.mockRejectedValueOnce(new Error('Temporary 503'));
    await render();
    expect(currentState()).toMatchObject({ enabled: true, available: true, error: true });

    await act(async () => currentState().setEnabled(false));
    expect(mocks.remove).toHaveBeenCalledWith({ endpoint: subscription.endpoint });
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(currentState()).toMatchObject({ enabled: false, error: false });
  });

  it('invalidates browser delivery on sign-out without an authenticated API request', async () => {
    mocks.userId = null;
    await render();
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledOnce());
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(currentState()).toMatchObject({ enabled: false, available: false });
  });
});
