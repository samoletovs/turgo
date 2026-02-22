/**
 * Liquidation Agent — Batch sell multiple listings under a shared deadline
 *
 * Accepts a batch of listing IDs + overall deadline. Creates a SellingAgent for
 * each with a shared deadline-based pricing curve. Tracks aggregate stats:
 *   - Items sold / remaining
 *   - Total revenue collected
 *   - Projected remaining value
 *
 * Works alongside agent-selling.ts — each item gets its own SellingAgent but
 * they share a coordinated pricing strategy driven by the batch deadline.
 */

import { db } from "@/server/db";
import { URGENCY_HOURS } from "@/lib/constants";
import { generatePriceCurve } from "./agent-pricing";
import { calculateOptimalPrice } from "./agent-selling";
import type { PricingCurvePoint } from "@/types";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface LiquidationBatchConfig {
  userId: string;
  listingIds: string[];
  deadline: Date;
  urgency: string; // maps to URGENCY_HOURS
  strategy: "aggressive" | "balanced" | "patient";
  autoAcceptAbove?: number; // percentage of starting price
}

export interface LiquidationItem {
  listingId: string;
  sellingAgentId: string;
  title: string;
  startingPrice: number;
  currentPrice: number;
  minimumPrice: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  soldPrice?: number;
}

export interface LiquidationBatchStats {
  batchId: string;
  totalItems: number;
  itemsSold: number;
  itemsRemaining: number;
  itemsCancelled: number;
  totalRevenue: number;
  projectedRemainingValue: number;
  totalStartingValue: number;
  avgDiscountPercent: number;
  deadline: Date;
  deadlineProgress: number; // 0-1
  items: LiquidationItem[];
}

export interface LiquidationPricingStrategy {
  /** How steeply to drop prices. Higher = more aggressive */
  decayExponent: number;
  /** Minimum price floor as fraction of starting price */
  floorFraction: number;
  /** How much to accelerate remaining items when some sell */
  soldAccelerationFactor: number;
}

// ──────────────────────────────────────────────
// STRATEGY PRESETS
// ──────────────────────────────────────────────

const STRATEGY_PRESETS: Record<string, LiquidationPricingStrategy> = {
  aggressive: {
    decayExponent: 2.5,
    floorFraction: 0.3,
    soldAccelerationFactor: 1.2,
  },
  balanced: {
    decayExponent: 1.5,
    floorFraction: 0.5,
    soldAccelerationFactor: 1.1,
  },
  patient: {
    decayExponent: 0.8,
    floorFraction: 0.7,
    soldAccelerationFactor: 1.0,
  },
};

// ──────────────────────────────────────────────
// BATCH CREATION
// ──────────────────────────────────────────────

/**
 * Create a liquidation batch: creates SellingAgent per listing with shared
 * deadline-based pricing curves and stores the batch metadata.
 */
export async function createLiquidationBatch(
  config: LiquidationBatchConfig,
): Promise<{ batchId: string; agents: string[] }> {
  const strategy =
    STRATEGY_PRESETS[config.strategy] ?? STRATEGY_PRESETS.balanced;
  const batchId = `liq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Verify all listings belong to user and are active
  const listings = await db.listing.findMany({
    where: {
      id: { in: config.listingIds },
      userId: config.userId,
      status: "ACTIVE",
    },
    include: {
      category: { select: { id: true, slug: true } },
      sellingAgent: { select: { id: true } },
    },
  });

  if (listings.length === 0) {
    throw new Error("No eligible listings found for liquidation batch");
  }

  // Filter out already-managed listings
  const eligibleListings = listings.filter((l) => !l.sellingAgent);

  if (eligibleListings.length === 0) {
    throw new Error("All listings already have selling agents");
  }

  const agentIds: string[] = [];
  const totalHours = URGENCY_HOURS[config.urgency] || 168;

  for (const listing of eligibleListings) {
    // Get optimal starting price for each item
    let suggestedPrice = listing.price;
    try {
      const priceResult = await calculateOptimalPrice({
        categoryId: listing.categoryId,
        locationId: listing.locationId ?? undefined,
        condition: listing.condition,
        userBasePrice: listing.price,
        urgency: config.urgency,
      });
      suggestedPrice = priceResult.suggestedPrice;
    } catch {
      // fallback to listing price
    }

    const startingPrice = suggestedPrice;
    const minimumPrice = Math.round(startingPrice * strategy.floorFraction);
    const autoAcceptAbove = config.autoAcceptAbove
      ? Math.round(startingPrice * (config.autoAcceptAbove / 100))
      : Math.round(startingPrice * 0.8);

    // Generate liquidation pricing curve
    const curve = generateLiquidationCurve(
      startingPrice,
      minimumPrice,
      totalHours / 24,
      strategy,
    );

    // Create selling agent
    const agent = await db.sellingAgent.create({
      data: {
        userId: config.userId,
        listingId: listing.id,
        status: "ACTIVE",
        urgency: config.urgency as
          | "ONE_DAY"
          | "THREE_DAYS"
          | "ONE_WEEK"
          | "TWO_WEEKS"
          | "ONE_MONTH"
          | "NO_RUSH",
        startingPrice,
        minimumPrice,
        currentPrice: startingPrice,
        autoRespond: true,
        autoNegotiate: true,
        autoBoost: false,
        autoAcceptAbove,
        deadline: config.deadline,
        strategy: {
          type: "liquidation",
          batchId,
          strategyName: config.strategy,
          ...strategy,
        },
        priceAdjustSchedule: JSON.parse(JSON.stringify(curve)),
      },
    });

    // Mark listing as agent-managed
    await db.listing.update({
      where: { id: listing.id },
      data: { managedByAgent: true },
    });

    // Log action
    await db.agentAction.create({
      data: {
        sellingAgentId: agent.id,
        agentType: "SELLING",
        actionType: "LISTING_CREATED",
        description: `Liquidation batch "${batchId}": ${listing.title} starting at €${startingPrice}, floor €${minimumPrice}`,
        metadata: {
          batchId,
          startingPrice,
          minimumPrice,
          strategy: config.strategy,
          deadline: config.deadline.toISOString(),
        },
      },
    });

    agentIds.push(agent.id);
  }

  return { batchId, agents: agentIds };
}

// ──────────────────────────────────────────────
// BATCH STATS
// ──────────────────────────────────────────────

/** Get aggregate stats for a liquidation batch */
export async function getLiquidationBatchStats(
  batchId: string,
  userId: string,
): Promise<LiquidationBatchStats | null> {
  // Find all agents in this batch via strategy JSON
  const agents = await db.sellingAgent.findMany({
    where: {
      userId,
      strategy: { path: ["batchId"], equals: batchId },
    },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          price: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (agents.length === 0) return null;

  const items: LiquidationItem[] = agents.map((a) => ({
    listingId: a.listing.id,
    sellingAgentId: a.id,
    title: a.listing.title,
    startingPrice: a.startingPrice,
    currentPrice: a.listing.price,
    minimumPrice: a.minimumPrice,
    status: a.status,
    soldPrice:
      a.status === "COMPLETED" && a.bestOfferPrice
        ? a.bestOfferPrice
        : a.listing.status === "SOLD"
          ? a.listing.price
          : undefined,
  }));

  const itemsSold = items.filter((i) => i.soldPrice != null).length;
  const itemsCancelled = items.filter((i) => i.status === "CANCELLED").length;
  const itemsRemaining = items.filter(
    (i) => i.status === "ACTIVE" || i.status === "PAUSED",
  ).length;

  const totalRevenue = items.reduce((sum, i) => sum + (i.soldPrice ?? 0), 0);
  const totalStartingValue = items.reduce((sum, i) => sum + i.startingPrice, 0);
  const projectedRemainingValue = items
    .filter((i) => i.status === "ACTIVE" || i.status === "PAUSED")
    .reduce((sum, i) => sum + i.currentPrice, 0);

  const soldItems = items.filter((i) => i.soldPrice != null);
  const avgDiscountPercent =
    soldItems.length > 0
      ? soldItems.reduce(
          (sum, i) =>
            sum +
            ((i.startingPrice - (i.soldPrice ?? i.startingPrice)) /
              i.startingPrice) *
              100,
          0,
        ) / soldItems.length
      : 0;

  // Calculate deadline progress
  const firstAgent = agents[0];
  const deadline = firstAgent.deadline ?? new Date();
  const elapsed = Date.now() - firstAgent.createdAt.getTime();
  const total = deadline.getTime() - firstAgent.createdAt.getTime();
  const deadlineProgress = total > 0 ? Math.min(1, elapsed / total) : 1;

  return {
    batchId,
    totalItems: items.length,
    itemsSold,
    itemsRemaining,
    itemsCancelled,
    totalRevenue,
    projectedRemainingValue,
    totalStartingValue,
    avgDiscountPercent: Math.round(avgDiscountPercent * 10) / 10,
    deadline,
    deadlineProgress: Math.round(deadlineProgress * 1000) / 1000,
    items,
  };
}

/** Get all liquidation batch IDs for a user */
export async function getUserLiquidationBatches(
  userId: string,
): Promise<string[]> {
  const agents = await db.sellingAgent.findMany({
    where: {
      userId,
      strategy: { path: ["type"], equals: "liquidation" },
    },
    select: { strategy: true },
    distinct: ["strategy"],
  });

  const batchIds = new Set<string>();
  for (const agent of agents) {
    const strat = agent.strategy as Record<string, unknown> | null;
    if (strat?.batchId && typeof strat.batchId === "string") {
      batchIds.add(strat.batchId);
    }
  }

  return Array.from(batchIds);
}

// ──────────────────────────────────────────────
// BATCH PRICING ADJUSTMENT
// ──────────────────────────────────────────────

/**
 * Run coordinated pricing for a liquidation batch.
 * When some items sell, accelerate pricing on remaining items.
 */
export async function adjustLiquidationBatchPricing(
  batchId: string,
): Promise<{ adjusted: number; skipped: number }> {
  const agents = await db.sellingAgent.findMany({
    where: {
      status: "ACTIVE",
      strategy: { path: ["batchId"], equals: batchId },
    },
    include: {
      listing: {
        select: { id: true, title: true, price: true, status: true },
      },
    },
  });

  if (agents.length === 0) return { adjusted: 0, skipped: 0 };

  // Count sold items in batch for acceleration factor
  const allBatchAgents = await db.sellingAgent.findMany({
    where: { strategy: { path: ["batchId"], equals: batchId } },
    select: { status: true, listing: { select: { status: true } } },
  });

  const totalItems = allBatchAgents.length;
  const soldItems = allBatchAgents.filter(
    (a) => a.status === "COMPLETED" || a.listing.status === "SOLD",
  ).length;
  const soldRatio = totalItems > 0 ? soldItems / totalItems : 0;

  let adjusted = 0;
  let skipped = 0;

  for (const agent of agents) {
    const strat = agent.strategy as Record<string, unknown> | null;
    const soldAccel = (strat?.soldAccelerationFactor as number) ?? 1.1;
    const floorFraction = (strat?.floorFraction as number) ?? 0.5;

    if (!agent.deadline) {
      skipped++;
      continue;
    }

    const elapsed = Date.now() - agent.createdAt.getTime();
    const total = agent.deadline.getTime() - agent.createdAt.getTime();
    const progress = total > 0 ? Math.min(1, elapsed / total) : 1;

    // Accelerate based on how many items remain unsold
    const acceleration = 1 + (1 - soldRatio) * (soldAccel - 1);
    const effectiveProgress = Math.min(1, progress * acceleration);

    const minPrice = Math.round(agent.startingPrice * floorFraction);
    const range = agent.startingPrice - minPrice;
    const decay = Math.pow(1 - effectiveProgress, 1.5);
    const newPrice = Math.max(minPrice, Math.round(minPrice + range * decay));

    if (newPrice < agent.listing.price) {
      await db.listing.update({
        where: { id: agent.listing.id },
        data: { price: newPrice },
      });

      await db.sellingAgent.update({
        where: { id: agent.id },
        data: { currentPrice: newPrice },
      });

      await db.agentAction.create({
        data: {
          sellingAgentId: agent.id,
          agentType: "SELLING",
          actionType: "PRICE_ADJUST",
          description: `Liquidation pricing: €${agent.listing.price} → €${newPrice}. Batch progress ${(progress * 100).toFixed(0)}%, ${soldItems}/${totalItems} sold.`,
          metadata: {
            batchId,
            oldPrice: agent.listing.price,
            newPrice,
            progress,
            soldItems,
            totalItems,
          },
        },
      });

      adjusted++;
    } else {
      skipped++;
    }
  }

  return { adjusted, skipped };
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

/** Generate a liquidation-specific pricing curve */
function generateLiquidationCurve(
  startPrice: number,
  minPrice: number,
  totalDays: number,
  strategy: LiquidationPricingStrategy,
): PricingCurvePoint[] {
  const steps = Math.min(Math.ceil(totalDays), 15);
  const points: PricingCurvePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const day = Math.round(progress * totalDays);
    const decay = Math.pow(1 - progress, strategy.decayExponent);
    const price = Math.max(
      minPrice,
      Math.round(minPrice + (startPrice - minPrice) * decay),
    );

    let reason: string;
    if (i === 0) reason = "Batch start — market-optimized price";
    else if (progress < 0.25) reason = "Early liquidation — testing market";
    else if (progress < 0.5) reason = "Mid-phase — competitive pricing";
    else if (progress < 0.75) reason = "Accelerating — deadline approaching";
    else reason = "Final push — maximum clearance";

    points.push({ day, price, reason });
  }

  return points;
}
