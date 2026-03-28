import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

// Mock utils delay
vi.mock('@/lib/utils', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SSLV_SCRAPER_ENABLED = 'true';
  process.env.SSLV_SCRAPER_RATE_LIMIT_MS = '0';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

import { isScrapingEnabled, fetchCategoryStats, runScraper } from '@/server/services/scraper-sslv';

// ──────────────────────────────────────────────────────────────
// isScrapingEnabled
// ──────────────────────────────────────────────────────────────
describe('isScrapingEnabled', () => {
  it("returns true when SSLV_SCRAPER_ENABLED is 'true'", () => {
    process.env.SSLV_SCRAPER_ENABLED = 'true';
    expect(isScrapingEnabled()).toBe(true);
  });

  it('returns false when SSLV_SCRAPER_ENABLED is not set', () => {
    delete process.env.SSLV_SCRAPER_ENABLED;
    expect(isScrapingEnabled()).toBe(false);
  });

  it("returns false when SSLV_SCRAPER_ENABLED is 'false'", () => {
    process.env.SSLV_SCRAPER_ENABLED = 'false';
    expect(isScrapingEnabled()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// fetchCategoryStats
// ──────────────────────────────────────────────────────────────
describe('fetchCategoryStats', () => {
  it('extracts price statistics from HTML', async () => {
    const html = `
      <html>
        <body>
          <div class="d1">100.00 €</div>
          <div class="d2">200.00 €</div>
          <div class="d3">300.00 €</div>
          <div class="d4">400.00 €</div>
          <div class="d5">500.00 €</div>
        </body>
      </html>
    `;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    });

    const result = await fetchCategoryStats('cars', '/lv/transport/cars/');

    expect(result).not.toBeNull();
    expect(result!.categorySlug).toBe('cars');
    expect(result!.listingCount).toBe(5);
    expect(result!.medianPrice).toBe(300);
    expect(result!.avgPrice).toBe(300);
    expect(result!.minPrice).toBe(100);
    expect(result!.maxPrice).toBe(500);
  });

  it('returns null when no prices found', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><body>No listings here</body></html>'),
      });
    });

    const result = await fetchCategoryStats('cars', '/lv/transport/cars/');

    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await fetchCategoryStats('cars', '/lv/transport/cars/');

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('extracts location slug from URL', async () => {
    const html = '<div>500.00 €</div>';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    });

    const result = await fetchCategoryStats('cars', '/lv/transport/cars/riga/');

    expect(result).not.toBeNull();
    expect(result!.locationSlug).toBe('riga');
  });

  it('handles large prices correctly', async () => {
    const html = '<div>999 999.00 €</div><div>1 500 000.00 €</div>';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    });

    const result = await fetchCategoryStats('apartments', '/lv/real-estate/flats/');

    expect(result).not.toBeNull();
    expect(result!.listingCount).toBe(2);
  });

  it('filters out unreasonably large prices (>10M)', async () => {
    const html = '<div>100.00 €</div><div>99 999 999.00 €</div>';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    });

    const result = await fetchCategoryStats('cars', '/path/');

    expect(result).not.toBeNull();
    expect(result!.listingCount).toBe(1);
    expect(result!.maxPrice).toBe(100);
  });

  it('extracts average days to sell from dates', async () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);
    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

    const html = `
      <div>500.00 €</div>
      <span>${formatDate(tenDaysAgo)}</span>
      <span>${formatDate(twentyDaysAgo)}</span>
    `;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    });

    const result = await fetchCategoryStats('cars', '/path/');

    expect(result).not.toBeNull();
    expect(result!.avgDaysToSell).toBeDefined();
    expect(result!.avgDaysToSell!).toBeGreaterThan(0);
  });

  it('handles network error gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.reject(new Error('Network error'));
    });

    const result = await fetchCategoryStats('cars', '/path/');

    expect(result).toBeNull();
    errorSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────
// runScraper
// ──────────────────────────────────────────────────────────────
describe('runScraper', () => {
  it('returns zero results when scraping is disabled', async () => {
    process.env.SSLV_SCRAPER_ENABLED = 'false';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runScraper();

    expect(result.categoriesProcessed).toBe(0);
    expect(result.snapshotsCreated).toBe(0);
    expect(result.errors).toBe(0);
    logSpy.mockRestore();
  });

  it('processes all configured categories', async () => {
    const html = '<div>100.00 €</div><div>200.00 €</div>';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    mockDb.category.findFirst.mockResolvedValue({ id: 'cat-1' });
    mockDb.location.findFirst.mockResolvedValue({ id: 'loc-1' });
    mockDb.marketSnapshot.upsert.mockResolvedValue({});

    const result = await runScraper();

    expect(result.categoriesProcessed).toBeGreaterThan(0);
    logSpy.mockRestore();
  });

  it('counts errors when fetching fails', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') }) // robots.txt
      .mockResolvedValue({ ok: false, status: 500 }); // all category pages fail

    const result = await runScraper();

    expect(result.errors).toBeGreaterThan(0);
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
