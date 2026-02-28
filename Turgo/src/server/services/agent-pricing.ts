/**
 * Dynamic Pricing Engine — Urgency curves, market analysis
 * Provides price recommendations and manages automatic price adjustments
 */

import { db } from "@/server/db";
import { URGENCY_HOURS } from "@/lib/constants";
import type { PricingCurvePoint } from "@/types";

/** Get market price statistics for a category+location */
export async function getMarketStats(categoryId: string, locationId?: string) {
  const snapshot = await db.marketSnapshot.findFirst({
    where: {
      categoryId,
      ...(locationId ? { locationId } : {}),
    },
    orderBy: { date: "desc" },
  });

  if (!snapshot) {
    // Fallback: calculate from active listings
    const listings = await db.listing.findMany({
      where: { categoryId, status: "ACTIVE" },
      select: { price: true },
    });

    if (listings.length === 0) return null;

    const prices = listings.map((l) => Number(l.price)).sort((a, b) => a - b);
    const medianIdx = Math.floor(prices.length / 2);

    return {
      medianPrice: prices[medianIdx],
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      listingCount: prices.length,
      demandScore: null,
    };
  }

  return snapshot;
}

/** Generate urgency-based pricing curve */
export function generatePriceCurve(
  startPrice: number,
  minPrice: number,
  urgency: string,
): PricingCurvePoint[] {
  const totalHours = URGENCY_HOURS[urgency] || 168;
  const totalDays = totalHours / 24;
  const points: PricingCurvePoint[] = [];

  // Determine curve steepness based on urgency
  let exponent: number;
  switch (urgency) {
    case "ONE_DAY":
      exponent = 2.5;
      break;
    case "THREE_DAYS":
      exponent = 2.0;
      break;
    case "ONE_WEEK":
      exponent = 1.5;
      break;
    case "TWO_WEEKS":
      exponent = 1.3;
      break;
    case "ONE_MONTH":
      exponent = 1.1;
      break;
    case "NO_RUSH":
      exponent = 0.8;
      break;
    default:
      exponent = 1.5;
  }

  const steps = Math.min(Math.ceil(totalDays), 15);

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const day = Math.round(progress * totalDays);

    // Price decays from startPrice to minPrice along urgency curve
    const decay = Math.pow(1 - progress, exponent);
    const price = Math.round(minPrice + (startPrice - minPrice) * decay);

    points.push({
      day,
      price: Math.max(price, minPrice),
      reason: getPriceChangeReason(progress, urgency),
    });
  }

  return points;
}

/** Get human-readable reason for price change */
function getPriceChangeReason(progress: number, urgency: string): string {
  if (progress === 0)
    return "Starting price — optimized for maximum initial interest";
  if (progress < 0.2) return "Testing market response at premium price";
  if (progress < 0.4) return "Slight adjustment to increase visibility";
  if (progress < 0.6) return "Competitive pricing — attracting more inquiries";
  if (progress < 0.8) return "Approaching deadline — accelerating sale";
  return urgency === "NO_RUSH"
    ? "Long-term competitive price"
    : "Final push — maximum discount before deadline";
}

/** Get optimal posting time recommendation */
export function getOptimalPostingTime(categorySlug: string): {
  bestDay: string;
  bestHour: number;
  reasoning: string;
} {
  // Category-specific posting patterns (would be data-driven in production)
  const categoryPatterns: Record<
    string,
    { day: number; hour: number; reason: string }
  > = {
    cars: {
      day: 0,
      hour: 19,
      reason: "Car buyers are most active Sunday evenings",
    },
    apartments: {
      day: 1,
      hour: 9,
      reason: "Real estate searches peak Monday mornings",
    },
    electronics: {
      day: 4,
      hour: 18,
      reason: "Electronics shoppers browse Thursday/Friday evenings",
    },
    clothing: {
      day: 5,
      hour: 11,
      reason: "Fashion shoppers peak on Saturday mornings",
    },
    default: {
      day: 0,
      hour: 19,
      reason: "Sunday evening has the highest overall marketplace traffic",
    },
  };

  const pattern = categoryPatterns[categorySlug] || categoryPatterns.default;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return {
    bestDay: days[pattern.day],
    bestHour: pattern.hour,
    reasoning: pattern.reason,
  };
}

/** Calculate price adjustment schedule for a selling agent */
export function generatePriceAdjustSchedule(
  startPrice: number,
  minPrice: number,
  urgency: string,
): Array<{ dayOffset: number; targetPrice: number; dropPercent: number }> {
  const curve = generatePriceCurve(startPrice, minPrice, urgency);
  const schedule: Array<{
    dayOffset: number;
    targetPrice: number;
    dropPercent: number;
  }> = [];

  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1];
    const curr = curve[i];

    if (curr.price < prev.price) {
      const dropPercent = ((prev.price - curr.price) / prev.price) * 100;
      schedule.push({
        dayOffset: curr.day,
        targetPrice: curr.price,
        dropPercent: Math.round(dropPercent * 10) / 10,
      });
    }
  }

  return schedule;
}
