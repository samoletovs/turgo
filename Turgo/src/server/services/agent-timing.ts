/**
 * Timing Agent — Seasonal pattern analysis & optimal posting times
 *
 * Queries MarketSnapshot for seasonal patterns:
 *   - Best month / week / day of week to sell by category + location
 *   - Generates seasonal calendar data
 *   - API endpoint: category + location → optimal posting time + calendar
 *   - Surfaces in sell flow and concierge responses
 */

import { db } from "@/server/db";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface SeasonalPattern {
  month: number; // 0-11
  monthName: string;
  avgPrice: number;
  avgDaysToSell: number;
  listingCount: number;
  demandScore: number;
  /** 0-1 rating of how good this month is to sell */
  sellRating: number;
}

export interface WeekdayPattern {
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  dayName: string;
  avgListings: number;
  avgDemandScore: number;
  sellRating: number;
}

export interface OptimalTimingResult {
  categoryId: string;
  categoryName: string;
  locationId?: string;
  locationName?: string;

  /** Best month to sell (0-11) */
  bestMonth: number;
  bestMonthName: string;
  /** Best day of week (0=Sun..6=Sat) */
  bestDayOfWeek: number;
  bestDayName: string;
  /** Best hour to post (0-23) */
  bestHour: number;

  /** Current timing score (0-100): how good is NOW to post? */
  currentTimingScore: number;
  /** Recommendation text */
  recommendation: string;

  /** Monthly seasonal data for chart */
  seasonalCalendar: SeasonalPattern[];
  /** Day-of-week data */
  weekdayCalendar: WeekdayPattern[];
}

export interface TimingRecommendation {
  score: number; // 0-100
  action: "post_now" | "wait" | "good_enough";
  message: string;
  bestUpcoming: {
    date: string;
    reason: string;
  };
}

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Category-specific seasonality multipliers (month 0-11).
 * Values >1 = better than average, <1 = worse.
 * These serve as priors when historical data is sparse.
 */
const CATEGORY_SEASONALITY: Record<string, number[]> = {
  // Vehicles: spring/summer peak
  cars: [0.7, 0.75, 0.9, 1.1, 1.2, 1.15, 1.1, 1.05, 1.0, 0.9, 0.8, 0.65],
  motorcycles: [0.5, 0.6, 0.9, 1.2, 1.4, 1.3, 1.2, 1.1, 0.9, 0.7, 0.5, 0.4],
  bicycles: [0.4, 0.5, 0.9, 1.3, 1.4, 1.3, 1.2, 1.1, 0.9, 0.7, 0.5, 0.3],
  // Real estate: spring/fall peaks
  apartments: [
    0.8, 0.85, 1.0, 1.15, 1.2, 1.1, 0.9, 0.85, 1.1, 1.15, 0.95, 0.75,
  ],
  houses: [0.7, 0.8, 1.0, 1.2, 1.25, 1.15, 1.0, 0.9, 1.1, 1.1, 0.9, 0.7],
  // Electronics: Black Friday / Christmas / back-to-school
  electronics: [0.8, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.1, 1.2, 1.0, 1.3, 1.15],
  computers: [0.8, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.15, 1.25, 1.0, 1.2, 1.1],
  phones: [0.9, 0.85, 0.85, 0.9, 0.9, 0.95, 0.95, 1.0, 1.2, 1.1, 1.1, 1.1],
  // Clothing: season-dependent
  clothing: [0.7, 0.75, 1.0, 1.1, 1.05, 0.9, 0.8, 0.9, 1.2, 1.1, 1.0, 0.9],
  // Furniture: spring moving season
  furniture: [0.8, 0.85, 1.0, 1.15, 1.2, 1.15, 1.0, 1.05, 1.1, 0.95, 0.85, 0.7],
  // Default pattern
  default: [0.8, 0.85, 0.95, 1.05, 1.1, 1.0, 0.95, 0.95, 1.1, 1.05, 0.95, 0.8],
};

/** Best posting hours by category (when buyers are most active) */
const CATEGORY_BEST_HOURS: Record<string, { day: number; hour: number }> = {
  cars: { day: 0, hour: 19 }, // Sunday evening
  apartments: { day: 1, hour: 9 }, // Monday morning
  electronics: { day: 4, hour: 18 }, // Thursday evening
  clothing: { day: 5, hour: 11 }, // Saturday morning
  furniture: { day: 6, hour: 10 }, // Saturday morning
  computers: { day: 4, hour: 19 }, // Thursday evening
  phones: { day: 3, hour: 18 }, // Wednesday evening
  default: { day: 0, hour: 19 }, // Sunday evening
};

// ──────────────────────────────────────────────
// MAIN: OPTIMAL TIMING ANALYSIS
// ──────────────────────────────────────────────

/**
 * Analyze seasonal & weekly patterns for a category+location.
 * Combines historical MarketSnapshot data with category priors.
 */
export async function getOptimalTiming(
  categoryId: string,
  locationId?: string,
): Promise<OptimalTimingResult> {
  // Fetch category info for slug-based lookup
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, slug: true },
  });

  const categoryName =
    (category?.name as Record<string, string>)?.en ?? "Unknown";
  const categorySlug = category?.slug ?? "default";

  // Fetch location name if provided
  let locationName: string | undefined;
  if (locationId) {
    const location = await db.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });
    locationName = (location?.name as Record<string, string>)?.en;
  }

  // Fetch historical snapshots (up to 365 days)
  const snapshots = await db.marketSnapshot.findMany({
    where: {
      categoryId,
      ...(locationId ? { locationId } : {}),
      date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: "asc" },
  });

  // Build seasonal calendar from snapshots + category priors
  const seasonalCalendar = buildSeasonalCalendar(snapshots, categorySlug);

  // Build weekday patterns
  const weekdayCalendar = buildWeekdayCalendar(snapshots, categorySlug);

  // Find best month
  const bestMonthEntry = seasonalCalendar.reduce((best, curr) =>
    curr.sellRating > best.sellRating ? curr : best,
  );

  // Find best day of week
  const bestDayEntry = weekdayCalendar.reduce((best, curr) =>
    curr.sellRating > best.sellRating ? curr : best,
  );

  // Get best hour from category presets
  const hourPreset =
    CATEGORY_BEST_HOURS[categorySlug] ?? CATEGORY_BEST_HOURS.default;

  // Calculate current timing score
  const currentTimingScore = calculateCurrentTimingScore(
    seasonalCalendar,
    weekdayCalendar,
    hourPreset.hour,
  );

  // Generate recommendation
  const recommendation = generateTimingRecommendation(
    currentTimingScore,
    bestMonthEntry,
    bestDayEntry,
    hourPreset.hour,
  );

  return {
    categoryId,
    categoryName,
    locationId,
    locationName,
    bestMonth: bestMonthEntry.month,
    bestMonthName: bestMonthEntry.monthName,
    bestDayOfWeek: bestDayEntry.dayOfWeek,
    bestDayName: bestDayEntry.dayName,
    bestHour: hourPreset.hour,
    currentTimingScore,
    recommendation,
    seasonalCalendar,
    weekdayCalendar,
  };
}

/**
 * Quick recommendation for the sell flow:
 * "Should I post now or wait?"
 */
export async function getTimingRecommendation(
  categoryId: string,
  locationId?: string,
): Promise<TimingRecommendation> {
  const timing = await getOptimalTiming(categoryId, locationId);
  const score = timing.currentTimingScore;

  // Find next good posting window
  const now = new Date();
  const bestUpcoming = findNextGoodWindow(timing, now);

  if (score >= 75) {
    return {
      score,
      action: "post_now",
      message: `Great timing! ${timing.recommendation}`,
      bestUpcoming,
    };
  }

  if (score >= 45) {
    return {
      score,
      action: "good_enough",
      message: `Decent timing. ${timing.recommendation}`,
      bestUpcoming,
    };
  }

  return {
    score,
    action: "wait",
    message: `Consider waiting. ${timing.recommendation}`,
    bestUpcoming,
  };
}

// ──────────────────────────────────────────────
// CALENDAR BUILDERS
// ──────────────────────────────────────────────

function buildSeasonalCalendar(
  snapshots: Array<{
    date: Date;
    avgPrice: number | null;
    avgDaysToSell: number | null;
    listingCount: number;
    demandScore: number | null;
  }>,
  categorySlug: string,
): SeasonalPattern[] {
  const priors =
    CATEGORY_SEASONALITY[categorySlug] ?? CATEGORY_SEASONALITY.default;

  // Aggregate snapshots by month
  const monthBuckets = Array.from({ length: 12 }, () => ({
    prices: [] as number[],
    daysToSell: [] as number[],
    counts: [] as number[],
    demands: [] as number[],
  }));

  for (const snap of snapshots) {
    const month = snap.date.getMonth();
    if (snap.avgPrice != null) monthBuckets[month].prices.push(snap.avgPrice);
    if (snap.avgDaysToSell != null)
      monthBuckets[month].daysToSell.push(snap.avgDaysToSell);
    monthBuckets[month].counts.push(snap.listingCount);
    if (snap.demandScore != null)
      monthBuckets[month].demands.push(snap.demandScore);
  }

  return Array.from({ length: 12 }, (_, m) => {
    const bucket = monthBuckets[m];
    const hasData = bucket.prices.length > 0;

    const avgPrice = hasData
      ? bucket.prices.reduce((a, b) => a + b, 0) / bucket.prices.length
      : 0;
    const avgDaysToSell =
      hasData && bucket.daysToSell.length > 0
        ? bucket.daysToSell.reduce((a, b) => a + b, 0) /
          bucket.daysToSell.length
        : 14;
    const listingCount = hasData
      ? Math.round(
          bucket.counts.reduce((a, b) => a + b, 0) / bucket.counts.length,
        )
      : 0;
    const demandScore =
      hasData && bucket.demands.length > 0
        ? bucket.demands.reduce((a, b) => a + b, 0) / bucket.demands.length
        : 1;

    // Sell rating: combine data-driven rating with prior
    const dataRating = hasData
      ? Math.min(
          1,
          (demandScore / 2 + (1 / Math.max(avgDaysToSell, 1)) * 10) / 2,
        )
      : 0;
    const priorRating = (priors[m] - 0.3) / 0.7; // normalize 0.3-1.4 to ~0-1
    const dataWeight = Math.min(1, bucket.prices.length / 12); // more data = more weight
    const sellRating =
      dataWeight * dataRating +
      (1 - dataWeight) * Math.max(0, Math.min(1, priorRating));

    return {
      month: m,
      monthName: MONTH_NAMES[m],
      avgPrice: Math.round(avgPrice),
      avgDaysToSell: Math.round(avgDaysToSell * 10) / 10,
      listingCount,
      demandScore: Math.round(demandScore * 100) / 100,
      sellRating: Math.round(sellRating * 100) / 100,
    };
  });
}

function buildWeekdayCalendar(
  snapshots: Array<{
    date: Date;
    listingCount: number;
    demandScore: number | null;
  }>,
  categorySlug: string,
): WeekdayPattern[] {
  // Aggregate by day of week
  const dayBuckets = Array.from({ length: 7 }, () => ({
    listings: [] as number[],
    demands: [] as number[],
  }));

  for (const snap of snapshots) {
    const dow = snap.date.getDay();
    dayBuckets[dow].listings.push(snap.listingCount);
    if (snap.demandScore != null)
      dayBuckets[dow].demands.push(snap.demandScore);
  }

  // Best posting day prior by category
  const bestDayPrior =
    CATEGORY_BEST_HOURS[categorySlug]?.day ?? CATEGORY_BEST_HOURS.default.day;

  return Array.from({ length: 7 }, (_, d) => {
    const bucket = dayBuckets[d];
    const hasData = bucket.listings.length > 0;

    const avgListings = hasData
      ? bucket.listings.reduce((a, b) => a + b, 0) / bucket.listings.length
      : 0;
    const avgDemand =
      hasData && bucket.demands.length > 0
        ? bucket.demands.reduce((a, b) => a + b, 0) / bucket.demands.length
        : 1;

    // Rating: combine data with prior (prior gives 1.0 to best day, 0.5 to others)
    const priorRating = d === bestDayPrior ? 1.0 : 0.5;
    const dataRating = hasData ? Math.min(1, avgDemand / 2) : 0;
    const weight = Math.min(1, bucket.listings.length / 30);
    const sellRating = weight * dataRating + (1 - weight) * priorRating;

    return {
      dayOfWeek: d,
      dayName: DAY_NAMES[d],
      avgListings: Math.round(avgListings),
      avgDemandScore: Math.round(avgDemand * 100) / 100,
      sellRating: Math.round(sellRating * 100) / 100,
    };
  });
}

// ──────────────────────────────────────────────
// SCORING
// ──────────────────────────────────────────────

function calculateCurrentTimingScore(
  seasonal: SeasonalPattern[],
  weekday: WeekdayPattern[],
  bestHour: number,
): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  // Monthly component (0-40 points)
  const monthRating = seasonal[currentMonth]?.sellRating ?? 0.5;
  const monthScore = monthRating * 40;

  // Weekday component (0-30 points)
  const dayRating = weekday[currentDay]?.sellRating ?? 0.5;
  const dayScore = dayRating * 30;

  // Hour component (0-30 points)
  const hourDiff = Math.abs(currentHour - bestHour);
  const hourScore = Math.max(0, 30 - hourDiff * 4);

  return Math.round(Math.min(100, monthScore + dayScore + hourScore));
}

function generateTimingRecommendation(
  score: number,
  bestMonth: SeasonalPattern,
  bestDay: WeekdayPattern,
  bestHour: number,
): string {
  const now = new Date();
  const currentMonth = now.getMonth();
  const parts: string[] = [];

  if (currentMonth === bestMonth.month) {
    parts.push(
      `This month (${bestMonth.monthName}) is the best time to sell in this category.`,
    );
  } else {
    parts.push(`Peak selling month: ${bestMonth.monthName}.`);
  }

  parts.push(`Best day: ${bestDay.dayName} around ${bestHour}:00.`);

  if (score >= 75) {
    parts.push("Conditions are excellent right now!");
  } else if (score >= 45) {
    parts.push("Conditions are reasonable. Posting now is fine.");
  } else {
    parts.push(
      `Waiting for ${bestDay.dayName} around ${bestHour}:00 could improve visibility.`,
    );
  }

  return parts.join(" ");
}

function findNextGoodWindow(
  timing: OptimalTimingResult,
  from: Date,
): { date: string; reason: string } {
  // Find the next occurrence of the best day of week
  const current = new Date(from);
  current.setHours(timing.bestHour, 0, 0, 0);

  // Move to next best day
  const daysUntilBest = (timing.bestDayOfWeek - current.getDay() + 7) % 7 || 7;
  current.setDate(current.getDate() + daysUntilBest);

  return {
    date: current.toISOString(),
    reason: `${timing.bestDayName} at ${timing.bestHour}:00 — peak traffic for this category`,
  };
}
