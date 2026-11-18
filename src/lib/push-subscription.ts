export interface PushSubscriptionApi {
  getKey: () => Promise<string>;
  register: (subscription: { endpoint: string; p256dh: string; auth: string }) => Promise<unknown>;
  remove: (endpoint: string) => Promise<unknown>;
}

export async function savePushSubscription(
  subscription: PushSubscription,
  api: PushSubscriptionApi,
) {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('Invalid browser push subscription');
  }
  await api.register({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

export async function enablePush(
  registration: ServiceWorkerRegistration,
  api: PushSubscriptionApi,
) {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notification permission not granted');
  }
  let subscription = await registration.pushManager.getSubscription();
  const existing = subscription;
  if (!subscription) {
    const key = await api.getKey();
    if (!key) throw new Error('Push notifications are not configured');
    const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(decoded, (character) => character.charCodeAt(0)),
    });
  }
  try {
    await savePushSubscription(subscription, api);
  } catch (error) {
    if (!existing) await subscription.unsubscribe();
    throw error;
  }
}

export async function disablePush(
  registration: ServiceWorkerRegistration,
  api: PushSubscriptionApi,
) {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  // Keep the browser subscription available for a retry if the server is unreachable.
  await api.remove(subscription.endpoint);
  if (!(await subscription.unsubscribe())) {
    throw new Error('Could not unsubscribe this browser');
  }
}
