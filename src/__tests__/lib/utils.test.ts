import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPrice,
  slugify,
  formatRelativeTime,
  getLocalizedName,
  truncate,
  cn,
  getInitials,
  delay,
} from '@/lib/utils';

// ──────────────────────────────────────────────
// formatPrice
// ──────────────────────────────────────────────
describe('formatPrice', () => {
  it('formats a normal price in EUR', () => {
    const result = formatPrice(99.99);
    // Intl output varies by environment; just check it contains the number
    expect(result).toContain('99.99');
  });

  it('formats zero', () => {
    const result = formatPrice(0);
    expect(result).toContain('0');
  });

  it('formats negative price', () => {
    const result = formatPrice(-50);
    expect(result).toContain('50');
  });

  it('formats large value', () => {
    const result = formatPrice(1_000_000);
    expect(result).toMatch(/1[,.]000[,.]000/);
  });

  it('formats integer without unnecessary decimals', () => {
    const result = formatPrice(100);
    // minimumFractionDigits=0 means no .00
    expect(result).not.toMatch(/\.00$/);
  });

  it('accepts different currency', () => {
    const result = formatPrice(25, 'USD');
    expect(result).toMatch(/\$|USD/);
  });
});

// ──────────────────────────────────────────────
// slugify
// ──────────────────────────────────────────────
describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('lowercases input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(slugify('hello@world!')).toBe('helloworld');
  });

  it('collapses multiple separators', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles underscores', () => {
    expect(slugify('foo_bar')).toBe('foo-bar');
  });

  it('handles unicode by stripping non-word chars', () => {
    const result = slugify('café résumé');
    // \w keeps only [a-zA-Z0-9_] and hyphens; accented chars get stripped
    expect(result).toBe('caf-rsum');
  });
});

// ──────────────────────────────────────────────
// formatRelativeTime
// ──────────────────────────────────────────────
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent dates", () => {
    const result = formatRelativeTime(new Date('2026-02-22T11:59:45Z'));
    expect(result).toBe('just now');
  });

  it('returns minutes ago', () => {
    const result = formatRelativeTime(new Date('2026-02-22T11:55:00Z'));
    expect(result).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const result = formatRelativeTime(new Date('2026-02-22T09:00:00Z'));
    expect(result).toBe('3h ago');
  });

  it('returns days ago', () => {
    const result = formatRelativeTime(new Date('2026-02-20T12:00:00Z'));
    expect(result).toBe('2d ago');
  });

  it('handles exactly 1 minute ago', () => {
    const result = formatRelativeTime(new Date('2026-02-22T11:59:00Z'));
    expect(result).toBe('1m ago');
  });

  it('handles exactly 1 hour ago', () => {
    const result = formatRelativeTime(new Date('2026-02-22T11:00:00Z'));
    expect(result).toBe('1h ago');
  });

  it('handles exactly 1 day ago', () => {
    const result = formatRelativeTime(new Date('2026-02-21T12:00:00Z'));
    expect(result).toBe('1d ago');
  });

  it("handles future date (negative diff) as 'just now'", () => {
    // Future dates produce negative diffs; Math.floor of small negative → -1
    // but diffDay/diffHour/diffMin will be <= 0 so none match, falls to "just now"
    const result = formatRelativeTime(new Date('2026-02-22T13:00:00Z'));
    expect(result).toBe('just now');
  });
});

// ──────────────────────────────────────────────
// getLocalizedName
// ──────────────────────────────────────────────
describe('getLocalizedName', () => {
  it('returns the string directly if name is a string', () => {
    expect(getLocalizedName('Hello', 'en')).toBe('Hello');
  });

  it('returns locale value from record', () => {
    const name = { en: 'Cars', lv: 'Auto', ru: 'Авто' };
    expect(getLocalizedName(name, 'lv')).toBe('Auto');
  });

  it('falls back to fallbackLocale when locale missing', () => {
    const name = { en: 'Cars', lv: 'Auto' };
    expect(getLocalizedName(name, 'ru')).toBe('Cars');
  });

  it('falls back to first value when both locales missing', () => {
    const name = { de: 'Autos' };
    expect(getLocalizedName(name, 'en', 'lv')).toBe('Autos');
  });

  it('returns empty string for empty record', () => {
    expect(getLocalizedName({}, 'en')).toBe('');
  });

  it('returns stringified null', () => {
    expect(getLocalizedName(null, 'en')).toBe('');
  });

  it('returns stringified undefined', () => {
    expect(getLocalizedName(undefined, 'en')).toBe('');
  });

  it('returns stringified number', () => {
    expect(getLocalizedName(42, 'en')).toBe('42');
  });
});

// ──────────────────────────────────────────────
// truncate
// ──────────────────────────────────────────────
describe('truncate', () => {
  it('returns full text when shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns full text when exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    const result = truncate('hello world', 5);
    expect(result).toBe('hello…');
  });

  it('trims trailing space before ellipsis', () => {
    const result = truncate('hello world foo', 6);
    expect(result).toBe('hello…');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles maxLength of 0', () => {
    expect(truncate('hello', 0)).toBe('…');
  });

  it('handles maxLength of 1', () => {
    expect(truncate('hello', 1)).toBe('h…');
  });
});

// ──────────────────────────────────────────────
// cn (utility — basic sanity)
// ──────────────────────────────────────────────
describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-3')).toBe('px-2 py-3');
  });

  it('handles conditional classes', () => {
    expect(cn('px-2', false && 'hidden', 'py-3')).toBe('px-2 py-3');
  });

  it('merges Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

// ──────────────────────────────────────────────
// getInitials
// ──────────────────────────────────────────────
describe('getInitials', () => {
  it('returns two letter initials', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('caps at 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});

// ──────────────────────────────────────────────
// delay
// ──────────────────────────────────────────────
describe('delay', () => {
  it('resolves after given ms', async () => {
    vi.useFakeTimers();
    const p = delay(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
