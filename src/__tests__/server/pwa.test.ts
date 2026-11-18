import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

const publicPath = resolve(process.cwd(), 'public');
const source = readFileSync(resolve(publicPath, 'sw.js'), 'utf8');

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const clients = { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() };
  const registration = { showNotification: vi.fn().mockResolvedValue(undefined) };
  runInNewContext(source, {
    self: {
      location: { origin: 'https://turgo.test' },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners[type] = handler;
      },
      registration,
      clients,
    },
    URL,
  });
  return { listeners, clients, registration };
}

describe('installable PWA assets', () => {
  it('has a manifest with real, correctly sized PNG icons', async () => {
    const manifest = JSON.parse(readFileSync(resolve(publicPath, 'manifest.json'), 'utf8'));
    expect(manifest.name).toContain('Turgo');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons) {
      const metadata = await sharp(resolve(publicPath, icon.src.slice(1))).metadata();
      expect(icon.type).toBe('image/png');
      expect(icon.sizes).toBe(`${metadata.width}x${metadata.height}`);
      expect(metadata.format).toBe('png');
    }
    expect((await sharp(resolve(publicPath, 'badge-72.png')).metadata()).width).toBe(72);
  });

  it('executes as JavaScript and displays incoming push content', async () => {
    const { listeners, registration } = worker();
    const waitUntil = vi.fn();
    listeners.push({
      data: { json: () => ({ title: 'New message', body: 'Hello', data: { url: '/messages' } }) },
      waitUntil,
    });
    expect(registration.showNotification).toHaveBeenCalledWith(
      'New message',
      expect.objectContaining({ body: 'Hello', data: { url: '/messages' } }),
    );
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it('ignores malformed push payloads', () => {
    const { listeners, registration } = worker();
    listeners.push({
      data: {
        json: () => {
          throw new Error('Invalid JSON');
        },
      },
    });
    listeners.push({ data: { json: () => null } });
    listeners.push({});
    expect(registration.showNotification).not.toHaveBeenCalled();
  });

  it.each([
    ['/lv/dashboard/messages', 'https://turgo.test/lv/dashboard/messages'],
    ['https://evil.test/phishing', 'https://turgo.test/'],
    ['//evil.test/phishing', 'https://turgo.test/'],
    ['javascript:alert(1)', 'https://turgo.test/'],
    ['http://[', 'https://turgo.test/'],
  ])('opens a safe destination for %s', async (url, expected) => {
    const { listeners, clients } = worker();
    let task: Promise<unknown> | undefined;
    const close = vi.fn();
    listeners.notificationclick({
      notification: { close, data: { url } },
      waitUntil: (promise: Promise<unknown>) => {
        task = promise;
      },
    });
    await task;
    expect(close).toHaveBeenCalledOnce();
    expect(clients.openWindow).toHaveBeenCalledWith(expected);
  });

  it('focuses an exact existing destination rather than a substring match', async () => {
    const { listeners, clients } = worker();
    const wrongFocus = vi.fn();
    const focus = vi.fn();
    clients.matchAll.mockResolvedValue([
      { url: 'https://turgo.test/messages/other', focus: wrongFocus },
      { url: 'https://turgo.test/messages', focus },
    ]);
    let task: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: { close: vi.fn(), data: { url: '/messages' } },
      waitUntil: (promise: Promise<unknown>) => {
        task = promise;
      },
    });
    await task;
    expect(focus).toHaveBeenCalledOnce();
    expect(wrongFocus).not.toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it('does not navigate on dismissal', () => {
    const { listeners, clients } = worker();
    const close = vi.fn();
    const waitUntil = vi.fn();
    listeners.notificationclick({ notification: { close }, action: 'dismiss', waitUntil });
    expect(close).toHaveBeenCalledOnce();
    expect(waitUntil).not.toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });
});
