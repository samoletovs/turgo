'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpcClient } from '@/lib/trpc/client';
import { disablePush, enablePush, savePushSubscription } from '@/lib/push-subscription';

const api = {
  getKey: async () => (await trpcClient.notification.getVapidKey.query()).key,
  register: (input: { endpoint: string; p256dh: string; auth: string }) =>
    trpcClient.notification.registerPush.mutate(input),
  remove: (endpoint: string) => trpcClient.notification.removePush.mutate({ endpoint }),
};

const PushContext = createContext({
  enabled: false,
  available: false,
  busy: false,
  error: false,
  setEnabled: async (_enabled: boolean) => {},
});

export function PushNotifications({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const operations = useRef<Promise<void>>(Promise.resolve());
  const lifecycle = useRef({ active: true });
  const account = useRef<string | undefined>(undefined);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = operations.current.catch(() => {}).then(operation);
    operations.current = next;
    return next;
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    const token = { active: true };
    lifecycle.current = token;
    const accountChanged = status !== 'loading' && !!account.current && account.current !== userId;
    if (status !== 'loading') account.current = userId;
    setAvailable(false);
    setBusy(false);
    setError(false);
    void enqueue(async () => {
      if (cancelled && !accountChanged) return;
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const worker = await navigator.serviceWorker.ready;
      registration.current = worker;
      // Do not skip logout cleanup when another session change is already queued.
      if (accountChanged) {
        const previous = await worker.pushManager?.getSubscription();
        await previous?.unsubscribe();
      }
      if (cancelled) return;
      if (!('PushManager' in window) || !('Notification' in window) || status === 'loading') {
        return;
      }
      const subscription = await worker.pushManager.getSubscription();
      if (cancelled) return;
      if (status === 'authenticated' && userId) {
        setEnabled(!!subscription && Notification.permission === 'granted');
        setAvailable(true);
        if (subscription && Notification.permission === 'granted') {
          await savePushSubscription(subscription, api);
        }
      } else {
        // Logging out invalidates delivery to this browser, even without an authenticated API.
        await subscription?.unsubscribe();
        if (!cancelled) setEnabled(false);
      }
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      token.active = false;
    };
  }, [status, userId, enqueue]);

  async function changeEnabled(value: boolean) {
    if (!registration.current || !available || busy) return;
    const worker = registration.current;
    const token = lifecycle.current;
    const isCurrent = () => token.active;
    // Request immediately during the click, not after waiting for queued network work.
    const permission = value ? Notification.requestPermission() : undefined;
    setBusy(true);
    setError(false);
    try {
      await enqueue(async () => {
        if (!isCurrent()) return;
        if (value) await enablePush(worker, api, permission, isCurrent);
        else await disablePush(worker, api);
        if (isCurrent()) setEnabled(value);
      });
    } catch (error) {
      if (isCurrent()) {
        setError(true);
        throw error;
      }
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  return (
    <PushContext.Provider value={{ enabled, available, busy, error, setEnabled: changeEnabled }}>
      {children}
    </PushContext.Provider>
  );
}

export const usePushNotifications = () => useContext(PushContext);
