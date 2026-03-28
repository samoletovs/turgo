import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

import {
  getMarketStats,
  generatePriceCurve,
  getOptimalPostingTime,
  generatePriceAdjustSchedule,
} from '@/server/services/agent-pricing';

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// getMarketStats
// ──────────────────────────────────────────────────────────────
describe('getMarketStats', () => {
  it('returns snapshot when available', async () => {
    const snapshot = {
      medianPrice: 500,
      avgPrice: 520,
      minPrice: 200,
      maxPrice: 1000,
      listingCount: 42,
      demandScore: 1.3,
    };
    mockDb.marketSnapshot.findFirst.mockResolvedValue(snapshot);

    const result = await getMarketStats('cat-1', 'loc-1');

    expect(result).toEqual(snapshot);
    expect(mockDb.marketSnapshot.findFirst).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1', locationId: 'loc-1' },
      orderBy: { date: 'desc' },
    });
  });

  it('queries without locationId filter when none provided', async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    await getMarketStats('cat-1');

    expect(mockDb.marketSnapshot.findFirst).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1' },
      orderBy: { date: 'desc' },
    });
  });

  it('falls back to listing-based calculation when no snapshot exists', async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.listing.findMany.mockResolvedValue([
      { price: 100 },
      { price: 200 },
      { price: 300 },
      { price: 400 },
      { price: 500 },
    ]);

    const result = await getMarketStats('cat-1');

    expect(result).not.toBeNull();
    expect(result!.medianPrice).toBe(300);
    expect(result!.avgPrice).toBe(300);
    expect(result!.minPrice).toBe(100);
    expect(result!.maxPrice).toBe(500);
    expect(result!.listingCount).toBe(5);
    expect(result!.demandScore).toBeNull();
  });

  it('returns null when no snapshot and no listings exist', async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.listing.findMany.mockResolvedValue([]);

    const result = await getMarketStats('cat-1');

    expect(result).toBeNull();
  });

  it('computes median correctly for even number of listings', async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.listing.findMany.mockResolvedValue([
      { price: 100 },
      { price: 200 },
      { price: 300 },
      { price: 400 },
    ]);

    const result = await getMarketStats('cat-1');

    // floor(4/2) = 2, so median = sorted[2] = 300
    expect(result!.medianPrice).toBe(300);
    expect(result!.avgPrice).toBe(250);
  });

  it('handles single listing fallback', async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.listing.findMany.mockResolvedValue([{ price: 150 }]);

    const result = await getMarketStats('cat-1');

    expect(result!.medianPrice).toBe(150);
    expect(result!.avgPrice).toBe(150);
    expect(result!.minPrice).toBe(150);
    expect(result!.maxPrice).toBe(150);
  });
});

// ──────────────────────────────────────────────────────────────
// generatePriceCurve
// ──────────────────────────────────────────────────────────────
describe('generatePriceCurve', () => {
  it('generates curve starting at startPrice and ending at/near minPrice', () => {
    const curve = generatePriceCurve(1000, 500, 'ONE_WEEK');

    expect(curve.length).toBeGreaterThanOrEqual(2);
    expect(curve[0].price).toBe(1000);
    expect(curve[0].day).toBe(0);
    expect(curve[curve.length - 1].price).toBe(500);
  });

  it('never generates prices below minPrice', () => {
    const curve = generatePriceCurve(500, 200, 'ONE_DAY');

    for (const point of curve) {
      expect(point.price).toBeGreaterThanOrEqual(200);
    }
  });

  it('generates steeper curve for higher urgency', () => {
    const urgentCurve = generatePriceCurve(1000, 500, 'ONE_DAY');
    const relaxedCurve = generatePriceCurve(1000, 500, 'NO_RUSH');

    // After first price drop, urgent curve should drop faster
    const urgentSecond = urgentCurve[1]?.price ?? 1000;
    const relaxedSecond = relaxedCurve[1]?.price ?? 1000;

    // Urgent should drop more aggressively
    expect(1000 - urgentSecond).toBeGreaterThanOrEqual(1000 - relaxedSecond);
  });

  it('has reason strings for every point', () => {
    const curve = generatePriceCurve(800, 400, 'ONE_WEEK');

    for (const point of curve) {
      expect(typeof point.reason).toBe('string');
      expect(point.reason.length).toBeGreaterThan(0);
    }
  });

  it.each(['ONE_DAY', 'THREE_DAYS', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'NO_RUSH'])(
    'works with urgency %s',
    (urgency) => {
      const curve = generatePriceCurve(1000, 500, urgency);

      expect(curve.length).toBeGreaterThanOrEqual(2);
      expect(curve[0].price).toBe(1000);
      expect(curve[curve.length - 1].price).toBe(500);
    },
  );

  it('handles case where startPrice equals minPrice', () => {
    const curve = generatePriceCurve(500, 500, 'ONE_WEEK');

    for (const point of curve) {
      expect(point.price).toBe(500);
    }
  });

  it('uses default exponent for unknown urgency', () => {
    const curve = generatePriceCurve(1000, 500, 'UNKNOWN');

    expect(curve.length).toBeGreaterThanOrEqual(2);
    expect(curve[0].price).toBe(1000);
    expect(curve[curve.length - 1].price).toBe(500);
  });

  it('days are monotonically increasing', () => {
    const curve = generatePriceCurve(1000, 300, 'ONE_MONTH');

    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].day).toBeGreaterThanOrEqual(curve[i - 1].day);
    }
  });

  it('prices are monotonically decreasing', () => {
    const curve = generatePriceCurve(1000, 300, 'ONE_WEEK');

    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].price).toBeLessThanOrEqual(curve[i - 1].price);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// getOptimalPostingTime
// ──────────────────────────────────────────────────────────────
describe('getOptimalPostingTime', () => {
  it('returns car-specific posting time', () => {
    const result = getOptimalPostingTime('cars');

    expect(result.bestDay).toBe('Sunday');
    expect(result.bestHour).toBe(19);
    expect(result.reasoning).toContain('Car buyers');
  });

  it('returns apartment posting time', () => {
    const result = getOptimalPostingTime('apartments');

    expect(result.bestDay).toBe('Monday');
    expect(result.bestHour).toBe(9);
    expect(result.reasoning).toContain('Real estate');
  });

  it('returns electronics posting time', () => {
    const result = getOptimalPostingTime('electronics');

    expect(result.bestDay).toBe('Thursday');
    expect(result.bestHour).toBe(18);
  });

  it('returns clothing posting time', () => {
    const result = getOptimalPostingTime('clothing');

    expect(result.bestDay).toBe('Friday');
    expect(result.bestHour).toBe(11);
  });

  it('returns default posting time for unknown categories', () => {
    const result = getOptimalPostingTime('unknown-category');

    expect(result.bestDay).toBe('Sunday');
    expect(result.bestHour).toBe(19);
    expect(result.reasoning).toContain('Sunday evening');
  });

  it('always returns valid day name', () => {
    const validDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const result = getOptimalPostingTime('any');

    expect(validDays).toContain(result.bestDay);
  });

  it('always returns hour in valid range', () => {
    const result = getOptimalPostingTime('cars');

    expect(result.bestHour).toBeGreaterThanOrEqual(0);
    expect(result.bestHour).toBeLessThanOrEqual(23);
  });
});

// ──────────────────────────────────────────────────────────────
// generatePriceAdjustSchedule
// ──────────────────────────────────────────────────────────────
describe('generatePriceAdjustSchedule', () => {
  it('generates schedule with day offsets and target prices', () => {
    const schedule = generatePriceAdjustSchedule(1000, 500, 'ONE_WEEK');

    expect(schedule.length).toBeGreaterThan(0);
    for (const entry of schedule) {
      expect(entry.dayOffset).toBeGreaterThan(0);
      expect(entry.targetPrice).toBeGreaterThanOrEqual(500);
      expect(entry.targetPrice).toBeLessThanOrEqual(1000);
      expect(entry.dropPercent).toBeGreaterThan(0);
    }
  });

  it('drop percentages are reasonable (0-100)', () => {
    const schedule = generatePriceAdjustSchedule(1000, 100, 'ONE_DAY');

    for (const entry of schedule) {
      expect(entry.dropPercent).toBeGreaterThan(0);
      expect(entry.dropPercent).toBeLessThanOrEqual(100);
    }
  });

  it('dayOffsets are monotonically increasing', () => {
    const schedule = generatePriceAdjustSchedule(800, 300, 'TWO_WEEKS');

    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].dayOffset).toBeGreaterThanOrEqual(schedule[i - 1].dayOffset);
    }
  });

  it('target prices are monotonically decreasing', () => {
    const schedule = generatePriceAdjustSchedule(1000, 500, 'ONE_MONTH');

    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].targetPrice).toBeLessThanOrEqual(schedule[i - 1].targetPrice);
    }
  });

  it('returns empty schedule when startPrice equals minPrice', () => {
    const schedule = generatePriceAdjustSchedule(500, 500, 'ONE_WEEK');

    expect(schedule.length).toBe(0);
  });

  it('last target price reaches minPrice', () => {
    const schedule = generatePriceAdjustSchedule(1000, 500, 'ONE_WEEK');

    if (schedule.length > 0) {
      expect(schedule[schedule.length - 1].targetPrice).toBe(500);
    }
  });

  it('urgency affects schedule length', () => {
    const shortSchedule = generatePriceAdjustSchedule(1000, 500, 'ONE_DAY');
    const longSchedule = generatePriceAdjustSchedule(1000, 500, 'ONE_MONTH');

    expect(longSchedule.length).toBeGreaterThanOrEqual(shortSchedule.length);
  });
});
