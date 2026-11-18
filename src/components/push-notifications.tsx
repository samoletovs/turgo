'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  setEnabled: async (_enabled: boolean) => {},
});

export function PushNotifications({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    setAvailable(false);
    void (async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const worker = await navigator.serviceWorker.ready;
      if (cancelled) return;
      registration.current = worker;
      if (!('PushManager' in window) || !('Notification' in window) || status === 'loading') {
        return;
      }
      const subscription = await worker.pushManager.getSubscription();
      if (cancelled) return;
      if (status === 'authenticated' && userId) {
        if (subscription && Notification.permission === 'granted') {
          await savePushSubscription(subscription, api);
        }
        if (!cancelled) {
          setEnabled(!!subscription && Notification.permission === 'granted');
          setAvailable(true);
        }
      } else {
        // Logging out invalidates delivery to this browser, even without an authenticated API.
        await subscription?.unsubscribe();
        if (!cancelled) setEnabled(false);
      }
    })().catch(() => {
      // Registration and reconciliation can be retried on the next visit.
    });
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  async function changeEnabled(value: boolean) {
    if (!registration.current || !available || busy) return;
    setBusy(true);
    try {
      if (value) await enablePush(registration.current, api);
      else await disablePush(registration.current, api);
      setEnabled(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PushContext.Provider value={{ enabled, available, busy, setEnabled: changeEnabled }}>
      {children}
    </PushContext.Provider>
  );
}

export const usePushNotifications = () => useContext(PushContext);
