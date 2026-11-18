import { expect, test } from '@playwright/test';

// Run against an existing Next.js server; no database or push provider is needed.
test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});

test('serves installable assets and registers the worker from the locale layout', async ({
  page,
  request,
}) => {
  const response = await request.get('/manifest.json');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: expect.stringContaining('Turgo'),
    start_url: '/',
    display: 'standalone',
  });
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toContain('image/png');
  }
  await page.goto('/about');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  const scriptURL = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL;
  });
  expect(scriptURL).toBe(new URL('/sw.js', page.url()).href);
});

test('registered worker handles notification-click navigation and blocks external targets', async ({
  page,
  context,
}) => {
  const workerReady = context.waitForEvent('serviceworker');
  await page.goto('/about');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const worker = await workerReady;

  // Dispatch against the real worker listener; stub only browser window-opening APIs
  // because synthetic events cannot supply OS notification user activation.
  const destinations = await worker.evaluate(async () => {
    const opened: string[] = [];
    Object.defineProperty(self, 'clients', {
      value: {
        matchAll: async () => [],
        openWindow: async (url: string) => {
          opened.push(url);
        },
      },
    });
    for (const url of ['/lv/dashboard/messages', 'https://evil.example/phishing']) {
      let completed: Promise<unknown> | undefined;
      const event = new Event('notificationclick');
      Object.defineProperties(event, {
        notification: { value: { close() {}, data: { url } } },
        waitUntil: {
          value: (promise: Promise<unknown>) => {
            completed = promise;
          },
        },
      });
      self.dispatchEvent(event);
      await completed;
    }
    return opened;
  });
  const origin = new URL(page.url()).origin;
  expect(destinations).toEqual([`${origin}/lv/dashboard/messages`, `${origin}/`]);
});
