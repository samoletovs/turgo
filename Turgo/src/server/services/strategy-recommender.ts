/**
 * Strategy Recommendation Engine
 *
 * Analyzes 4 market signals (supply, price spread, time-on-market, price trend)
 * plus context (urgency, budget ratio) to recommend the optimal selling or buying
 * strategy for a given product/category.
 *
 * Returns a ranked recommendation with confidence score and human-readable reasoning.
 */

import { buildMarketContext } from "./agent-pricing";
import type {
  MarketContext,
  PriceTrendDirection,
  StrategyRecommendation,
} from "@/types";

// ──────────────────────────────────────────────
// SELLING STRATEGY RECOMMENDATION
// ──────────────────────────────────────────────

type SellingStrategyId = "SEALED_BID" | "FIXED_PRICE" | "DUTCH_AUCTION";

/**
 * Signal scoring matrix for selling strategies.
 * Each cell: how favorable that signal level is for the given strategy (0-1).
 */
const SELLING_SIGNAL_SCORES: Record<
  string,
  Record<SellingStrategyId, number>
> = {
  // Supply level
  "supply:low": { SEALED_BID: 0.9, FIXED_PRICE: 0.7, DUTCH_AUCTION: 0.2 },
  "supply:moderate": { SEALED_BID: 0.6, FIXED_PRICE: 0.8, DUTCH_AUCTION: 0.5 },
  "supply:high": { SEALED_BID: 0.3, FIXED_PRICE: 0.4, DUTCH_AUCTION: 0.9 },

  // Price spread
  "spread:wide": { SEALED_BID: 0.9, FIXED_PRICE: 0.3, DUTCH_AUCTION: 0.6 },
  "spread:moderate": { SEALED_BID: 0.6, FIXED_PRICE: 0.7, DUTCH_AUCTION: 0.6 },
  "spread:tight": { SEALED_BID: 0.3, FIXED_PRICE: 0.9, DUTCH_AUCTION: 0.4 },

  // Time on market (avg days)
  "time:fast": { SEALED_BID: 0.4, FIXED_PRICE: 0.9, DUTCH_AUCTION: 0.3 },
  "time:moderate": { SEALED_BID: 0.7, FIXED_PRICE: 0.6, DUTCH_AUCTION: 0.6 },
  "time:slow": { SEALED_BID: 0.8, FIXED_PRICE: 0.3, DUTCH_AUCTION: 0.9 },

  // Price trend
  "trend:rising": { SEALED_BID: 0.9, FIXED_PRICE: 0.5, DUTCH_AUCTION: 0.2 },
  "trend:stable": { SEALED_BID: 0.5, FIXED_PRICE: 0.9, DUTCH_AUCTION: 0.5 },
  "trend:falling": { SEALED_BID: 0.3, FIXED_PRICE: 0.4, DUTCH_AUCTION: 0.8 },
};

/** Signal weights for selling recommendation */
const SELLING_SIGNAL_WEIGHTS = {
  supply: 0.25,
  spread: 0.2,
  time: 0.25,
  trend: 0.3,
};

/** Urgency modifiers — higher urgency pushes toward faster strategies */
const URGENCY_MODIFIERS: Record<string, Record<SellingStrategyId, number>> = {
  ONE_DAY: { SEALED_BID: -0.3, FIXED_PRICE: 0.3, DUTCH_AUCTION: 0.2 },
  THREE_DAYS: { SEALED_BID: -0.15, FIXED_PRICE: 0.2, DUTCH_AUCTION: 0.1 },
  ONE_WEEK: { SEALED_BID: 0, FIXED_PRICE: 0.1, DUTCH_AUCTION: 0 },
  TWO_WEEKS: { SEALED_BID: 0.1, FIXED_PRICE: 0, DUTCH_AUCTION: 0 },
  ONE_MONTH: { SEALED_BID: 0.15, FIXED_PRICE: -0.1, DUTCH_AUCTION: 0.1 },
  NO_RUSH: { SEALED_BID: 0.2, FIXED_PRICE: -0.15, DUTCH_AUCTION: 0.15 },
};

/** Classify avg days to sell into fast/moderate/slow */
function classifyTimeOnMarket(
  avgDays: number | null,
): "fast" | "moderate" | "slow" {
  if (avgDays === null) return "moderate";
  if (avgDays <= 7) return "fast";
  if (avgDays <= 21) return "moderate";
  return "slow";
}

export async function recommendSellingStrategy(input: {
  categoryId: string;
  locationId?: string;
  subcategorySlug?: string;
  urgency: string;
  price: number;
  minimumPrice: number;
}): Promise<StrategyRecommendation<SellingStrategyId> | null> {
  const ctx = await buildMarketContext(
    input.categoryId,
    input.locationId,
    input.subcategorySlug,
  );

  if (!ctx) return null;

  // Build signal keys
  const signals: string[] = [
    `supply:${ctx.supplyLevel}`,
    `spread:${ctx.priceSpread}`,
    `time:${classifyTimeOnMarket(ctx.avgDaysToSell)}`,
    `trend:${ctx.priceTrend.direction}`,
  ];

  const strategies: SellingStrategyId[] = [
    "SEALED_BID",
    "FIXED_PRICE",
    "DUTCH_AUCTION",
  ];
  const scores: Record<string, number> = {};

  for (const strategy of strategies) {
    let score = 0;
    const weights = SELLING_SIGNAL_WEIGHTS;

    // Accumulate weighted signal scores
    score +=
      (SELLING_SIGNAL_SCORES[signals[0]]?.[strategy] ?? 0.5) * weights.supply;
    score +=
      (SELLING_SIGNAL_SCORES[signals[1]]?.[strategy] ?? 0.5) * weights.spread;
    score +=
      (SELLING_SIGNAL_SCORES[signals[2]]?.[strategy] ?? 0.5) * weights.time;
    score +=
      (SELLING_SIGNAL_SCORES[signals[3]]?.[strategy] ?? 0.5) * weights.trend;

    // Apply urgency modifier
    const urgencyMod = URGENCY_MODIFIERS[input.urgency]?.[strategy] ?? 0;
    score += urgencyMod;

    // Clamp to 0-1
    scores[strategy] = Math.max(0, Math.min(1, score));
  }

  // Select best
  const best = strategies.reduce((a, b) => (scores[a] >= scores[b] ? a : b));
  const bestScore = scores[best];
  const secondBest = strategies
    .filter((s) => s !== best)
    .reduce((a, b) => (scores[a] >= scores[b] ? a : b));

  // Confidence: difference between best and second-best, scaled to 0-100
  const gap = bestScore - scores[secondBest];
  const confidence = Math.round(Math.min(95, Math.max(30, 50 + gap * 200)));

  return {
    strategyId: best,
    confidence,
    reasoning: buildSellingReasoning(best, ctx, input.urgency),
    marketContext: ctx,
    scores,
  };
}

function buildSellingReasoning(
  strategy: SellingStrategyId,
  ctx: MarketContext,
  urgency: string,
): string {
  const parts: string[] = [];
  const listingLabel = ctx.subcategorySlug
    ? `${ctx.listingCount} similar ${ctx.subcategorySlug} listings`
    : `${ctx.listingCount} listings in this category`;

  parts.push(
    `Based on ${listingLabel} (median €${ctx.medianPrice.toFixed(0)})`,
  );

  if (strategy === "SEALED_BID") {
    if (ctx.supplyLevel === "low")
      parts.push("low supply creates competitive demand");
    if (ctx.priceSpread === "wide")
      parts.push("wide price range means offers can vary significantly");
    if (ctx.priceTrend.direction === "rising")
      parts.push("prices are trending up — hold for best offer");
  } else if (strategy === "FIXED_PRICE") {
    if (ctx.priceSpread === "tight")
      parts.push("tight price range means the market agrees on value");
    if (ctx.priceTrend.direction === "stable")
      parts.push("stable prices indicate a mature market");
    if (ctx.avgDaysToSell !== null && ctx.avgDaysToSell <= 7)
      parts.push("items sell quickly at fair prices");
  } else if (strategy === "DUTCH_AUCTION") {
    if (ctx.supplyLevel === "high")
      parts.push("high supply means you need to stay competitive");
    if (ctx.priceTrend.direction === "falling")
      parts.push("prices are declining — better to sell sooner");
    if (ctx.avgDaysToSell !== null && ctx.avgDaysToSell > 21)
      parts.push("items take a while to sell — price drops attract attention");
  }

  const urgencyLabel = urgency.replace(/_/g, " ").toLowerCase();
  parts.push(`your ${urgencyLabel} timeline was also considered`);

  return parts.join(". ") + ".";
}

// ──────────────────────────────────────────────
// BUYING STRATEGY RECOMMENDATION
// ──────────────────────────────────────────────

type BuyingStrategyId =
  | "TIME_ESCALATION"
  | "MAX_BID"
  | "SNIPER"
  | "ACCEPT_LISTED"
  | "EARLY_BIRD";

/**
 * Signal scoring matrix for buying strategies.
 */
const BUYING_SIGNAL_SCORES: Record<string, Record<BuyingStrategyId, number>> = {
  // Supply level
  "supply:high": {
    TIME_ESCALATION: 0.8,
    MAX_BID: 0.3,
    SNIPER: 0.6,
    ACCEPT_LISTED: 0.2,
    EARLY_BIRD: 0.8,
  },
  "supply:moderate": {
    TIME_ESCALATION: 0.6,
    MAX_BID: 0.5,
    SNIPER: 0.7,
    ACCEPT_LISTED: 0.5,
    EARLY_BIRD: 0.6,
  },
  "supply:low": {
    TIME_ESCALATION: 0.3,
    MAX_BID: 0.9,
    SNIPER: 0.4,
    ACCEPT_LISTED: 0.8,
    EARLY_BIRD: 0.3,
  },

  // Price spread
  "spread:wide": {
    TIME_ESCALATION: 0.8,
    MAX_BID: 0.4,
    SNIPER: 0.5,
    ACCEPT_LISTED: 0.3,
    EARLY_BIRD: 0.8,
  },
  "spread:moderate": {
    TIME_ESCALATION: 0.6,
    MAX_BID: 0.6,
    SNIPER: 0.6,
    ACCEPT_LISTED: 0.6,
    EARLY_BIRD: 0.5,
  },
  "spread:tight": {
    TIME_ESCALATION: 0.3,
    MAX_BID: 0.7,
    SNIPER: 0.5,
    ACCEPT_LISTED: 0.8,
    EARLY_BIRD: 0.4,
  },

  // Time on market
  "time:fast": {
    TIME_ESCALATION: 0.3,
    MAX_BID: 0.8,
    SNIPER: 0.3,
    ACCEPT_LISTED: 0.7,
    EARLY_BIRD: 0.5,
  },
  "time:moderate": {
    TIME_ESCALATION: 0.6,
    MAX_BID: 0.5,
    SNIPER: 0.6,
    ACCEPT_LISTED: 0.5,
    EARLY_BIRD: 0.6,
  },
  "time:slow": {
    TIME_ESCALATION: 0.9,
    MAX_BID: 0.3,
    SNIPER: 0.8,
    ACCEPT_LISTED: 0.3,
    EARLY_BIRD: 0.4,
  },

  // Price trend
  "trend:rising": {
    TIME_ESCALATION: 0.3,
    MAX_BID: 0.8,
    SNIPER: 0.4,
    ACCEPT_LISTED: 0.7,
    EARLY_BIRD: 0.3,
  },
  "trend:stable": {
    TIME_ESCALATION: 0.6,
    MAX_BID: 0.5,
    SNIPER: 0.7,
    ACCEPT_LISTED: 0.5,
    EARLY_BIRD: 0.6,
  },
  "trend:falling": {
    TIME_ESCALATION: 0.8,
    MAX_BID: 0.2,
    SNIPER: 0.6,
    ACCEPT_LISTED: 0.3,
    EARLY_BIRD: 0.5,
  },
};

/** Signal weights for buying recommendation */
const BUYING_SIGNAL_WEIGHTS = {
  supply: 0.25,
  spread: 0.2,
  time: 0.25,
  trend: 0.3,
};

/**
 * Budget ratio modifier: how buyer's budget compares to market median.
 * ratio > 1.2 → generous (can afford to pay fast)
 * ratio 0.8-1.2 → fair (negotiate)
 * ratio < 0.8 → tight (need bargains)
 */
function getBudgetModifiers(ratio: number): Record<BuyingStrategyId, number> {
  if (ratio >= 1.2) {
    return {
      TIME_ESCALATION: -0.1,
      MAX_BID: 0.2,
      SNIPER: -0.1,
      ACCEPT_LISTED: 0.2,
      EARLY_BIRD: -0.1,
    };
  }
  if (ratio >= 0.8) {
    return {
      TIME_ESCALATION: 0.1,
      MAX_BID: 0,
      SNIPER: 0.1,
      ACCEPT_LISTED: 0,
      EARLY_BIRD: 0.1,
    };
  }
  // Tight budget — need bargains
  return {
    TIME_ESCALATION: 0.15,
    MAX_BID: -0.2,
    SNIPER: 0.2,
    ACCEPT_LISTED: -0.2,
    EARLY_BIRD: 0.2,
  };
}

export async function recommendBuyingStrategy(input: {
  categoryId: string;
  locationId?: string;
  subcategorySlug?: string;
  maxBudget: number;
  targetPrice?: number;
}): Promise<StrategyRecommendation<BuyingStrategyId> | null> {
  const ctx = await buildMarketContext(
    input.categoryId,
    input.locationId,
    input.subcategorySlug,
  );

  if (!ctx) return null;

  // Build signal keys
  const signals: string[] = [
    `supply:${ctx.supplyLevel}`,
    `spread:${ctx.priceSpread}`,
    `time:${classifyTimeOnMarket(ctx.avgDaysToSell)}`,
    `trend:${ctx.priceTrend.direction}`,
  ];

  const strategies: BuyingStrategyId[] = [
    "TIME_ESCALATION",
    "MAX_BID",
    "SNIPER",
    "ACCEPT_LISTED",
    "EARLY_BIRD",
  ];
  const scores: Record<string, number> = {};

  // Budget ratio
  const budgetRatio =
    ctx.medianPrice > 0 ? input.maxBudget / ctx.medianPrice : 1;
  const budgetMods = getBudgetModifiers(budgetRatio);

  for (const strategy of strategies) {
    let score = 0;
    const weights = BUYING_SIGNAL_WEIGHTS;

    score +=
      (BUYING_SIGNAL_SCORES[signals[0]]?.[strategy] ?? 0.5) * weights.supply;
    score +=
      (BUYING_SIGNAL_SCORES[signals[1]]?.[strategy] ?? 0.5) * weights.spread;
    score +=
      (BUYING_SIGNAL_SCORES[signals[2]]?.[strategy] ?? 0.5) * weights.time;
    score +=
      (BUYING_SIGNAL_SCORES[signals[3]]?.[strategy] ?? 0.5) * weights.trend;

    // Apply budget modifier
    score += budgetMods[strategy] ?? 0;

    scores[strategy] = Math.max(0, Math.min(1, score));
  }

  // Select best
  const best = strategies.reduce((a, b) => (scores[a] >= scores[b] ? a : b));
  const bestScore = scores[best];
  const secondBest = strategies
    .filter((s) => s !== best)
    .reduce((a, b) => (scores[a] >= scores[b] ? a : b));

  const gap = bestScore - scores[secondBest];
  const confidence = Math.round(Math.min(95, Math.max(30, 50 + gap * 200)));

  return {
    strategyId: best,
    confidence,
    reasoning: buildBuyingReasoning(best, ctx, budgetRatio),
    marketContext: ctx,
    scores,
  };
}

function buildBuyingReasoning(
  strategy: BuyingStrategyId,
  ctx: MarketContext,
  budgetRatio: number,
): string {
  const parts: string[] = [];
  const listingLabel = ctx.subcategorySlug
    ? `${ctx.listingCount} ${ctx.subcategorySlug} listings`
    : `${ctx.listingCount} listings`;

  parts.push(
    `Analyzed ${listingLabel} (median €${ctx.medianPrice.toFixed(0)})`,
  );

  if (strategy === "TIME_ESCALATION") {
    if (ctx.supplyLevel === "high")
      parts.push("plenty of options, so starting low is safe");
    if (ctx.priceTrend.direction === "falling")
      parts.push("prices are declining — patience will save money");
    if (ctx.avgDaysToSell !== null && ctx.avgDaysToSell > 14)
      parts.push("listings sit long, giving time to negotiate");
  } else if (strategy === "MAX_BID") {
    if (ctx.supplyLevel === "low")
      parts.push("limited supply means items go fast");
    if (ctx.priceTrend.direction === "rising")
      parts.push("prices are rising — buy before they go higher");
  } else if (strategy === "SNIPER") {
    if (ctx.avgDaysToSell !== null && ctx.avgDaysToSell > 14)
      parts.push(
        "many listings sit unsold — sellers grow flexible near expiry",
      );
    if (ctx.priceTrend.direction !== "rising")
      parts.push("no upward pressure, safe to wait");
  } else if (strategy === "ACCEPT_LISTED") {
    if (ctx.priceSpread === "tight")
      parts.push("prices are narrow — listed price is fair");
    if (ctx.supplyLevel === "low")
      parts.push("scarce items — paying asking price secures the deal");
  } else if (strategy === "EARLY_BIRD") {
    if (ctx.priceSpread === "wide")
      parts.push("wide price range means room to negotiate down");
    if (ctx.supplyLevel === "high")
      parts.push("high supply gives leverage for an early low offer");
  }

  if (budgetRatio < 0.8)
    parts.push(
      "your budget is below market median — a bargain strategy is key",
    );
  else if (budgetRatio > 1.2)
    parts.push("your budget exceeds the median — you can move quickly");

  return parts.join(". ") + ".";
}
