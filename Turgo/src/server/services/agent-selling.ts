/**
 * Selling Agent Service — Pricing strategy, auto-adjust, auto-respond
 * Manages the lifecycle of a selling agent from creation to sale
 */

import { db } from "@/server/db";
import { aiComplete, createMessages } from "./ai";
import { URGENCY_HOURS } from "@/lib/constants";
import type { PricingFactors, PricingCurvePoint } from "@/types";
import { getSellingStrategy } from "./strategies/registry";
import type {
  OfferContext,
  SellingAgentContext,
  ListingContext,
  BuyerOfferAck,
  SellerOfferView,
  TickAction,
  DeadlineAction,
} from "./strategies/types";
import type { SellingStrategyId } from "@prisma/client";

/** Calculate optimal starting price based on 10 factors */
export async function calculateOptimalPrice(params: {
  categoryId: string;
  locationId?: string;
  condition: string;
  userBasePrice: number;
  urgency: string;
}): Promise<{
  suggestedPrice: number;
  factors: PricingFactors;
  curve: PricingCurvePoint[];
  reasoning: string;
}> {
  // Fetch market data
  const snapshots = await db.marketSnapshot.findMany({
    where: {
      categoryId: params.categoryId,
      ...(params.locationId ? { locationId: params.locationId } : {}),
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  const latest = snapshots[0];
  const medianPrice = latest?.medianPrice ?? params.userBasePrice;
  const listingCount = latest?.listingCount ?? 0;
  const demandScore = latest?.demandScore ?? 1;

  // Calculate pricing factors (0-1 scale)
  const urgencyHours = URGENCY_HOURS[params.urgency] || 168;
  const urgencyFactor = Math.max(0, 1 - urgencyHours / 2160); // Higher urgency = lower factor

  const factors: PricingFactors = {
    urgency: urgencyFactor,
    marketSupply: listingCount > 50 ? 0.3 : listingCount > 20 ? 0.5 : 0.8,
    marketDemand: Math.min(1, (demandScore ?? 1) / 2),
    seasonality: getSeasonalityFactor(new Date().getMonth()),
    condition:
      params.condition === "NEW"
        ? 1
        : params.condition === "REFURBISHED"
          ? 0.7
          : 0.5,
    locationDemand: 0.6, // Default — would be calculated from location data
    postingTiming: getPostingTimeFactor(),
    competitionAge: 0.5, // Default
    priceElasticity: 0.5, // Default
    sellerReputation: 0.5, // Default
  };

  // Weighted composite score
  const weights = {
    urgency: 0.2,
    marketSupply: 0.15,
    marketDemand: 0.15,
    seasonality: 0.1,
    condition: 0.1,
    locationDemand: 0.08,
    postingTiming: 0.07,
    competitionAge: 0.05,
    priceElasticity: 0.05,
    sellerReputation: 0.05,
  };

  let compositeScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    compositeScore += factors[key as keyof PricingFactors] * weight;
  }

  // Starting price: user's base ± adjustment based on composite score
  const priceMultiplier = 0.8 + compositeScore * 0.4; // Range: 0.8x to 1.2x
  const suggestedPrice = Math.round(medianPrice * priceMultiplier);

  // Generate pricing curve based on urgency
  const curve = generatePricingCurve(
    suggestedPrice,
    params.userBasePrice * 0.7, // minimum at ~70% of base
    urgencyHours / 24, // days
  );

  return {
    suggestedPrice: Math.max(suggestedPrice, 1),
    factors,
    curve,
    reasoning: `Based on ${listingCount} similar listings. Market median: €${medianPrice.toFixed(0)}. Adjusted for ${params.urgency.replace("_", " ").toLowerCase()} urgency and ${params.condition.toLowerCase()} condition.`,
  };
}

/** Generate a pricing curve (price over time) */
function generatePricingCurve(
  startPrice: number,
  minPrice: number,
  totalDays: number,
): PricingCurvePoint[] {
  const curve: PricingCurvePoint[] = [];
  const steps = Math.min(totalDays, 10); // Max 10 price points

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const day = Math.round((i / steps) * totalDays);

    // Exponential decay curve — steeper at the end
    const decay = 1 - Math.pow(progress, 1.5);
    const price = Math.round(minPrice + (startPrice - minPrice) * decay);

    let reason = "";
    if (i === 0) reason = "Starting price — optimal for market conditions";
    else if (progress < 0.3)
      reason = "Slight adjustment — testing market response";
    else if (progress < 0.7)
      reason = "Moderate reduction — increasing competitiveness";
    else reason = "Aggressive pricing — approaching deadline";

    curve.push({ day, price, reason });
  }

  return curve;
}

/** Auto-respond to common buyer questions */
export async function generateAutoResponse(
  questionText: string,
  listingTitle: string,
  listingDescription: string,
): Promise<string | null> {
  const messages = createMessages(
    `You are a helpful selling assistant for a classifieds listing.
Listing: "${listingTitle}"
Description: "${listingDescription}"

If the buyer's question is a common FAQ (availability, condition, price negotiation, meeting location), 
provide a brief, friendly response. If the question requires the seller's personal input, return null.
Respond directly as if you are the seller's assistant.`,
    questionText,
  );

  try {
    const result = await aiComplete({
      messages,
      temperature: 0.5,
      maxTokens: 200,
    });
    return result.content;
  } catch {
    return null;
  }
}

/** Determine if the agent should adjust the price */
export function shouldAdjustPrice(agent: {
  currentPrice: number;
  minimumPrice: number;
  totalViews: number;
  totalInquiries: number;
  createdAt: Date;
  urgency: string;
}): { shouldAdjust: boolean; newPrice?: number; reason?: string } {
  const daysActive =
    (Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const urgencyDays = (URGENCY_HOURS[agent.urgency] || 168) / 24;
  const progress = daysActive / urgencyDays;
  const viewToInquiryRatio =
    agent.totalViews > 0 ? agent.totalInquiries / agent.totalViews : 0;

  // Low engagement trigger
  if (
    progress > 0.3 &&
    viewToInquiryRatio < 0.02 &&
    agent.currentPrice > agent.minimumPrice
  ) {
    const reduction = Math.min(0.05, progress * 0.1); // Max 5% reduction per adjustment
    const newPrice = Math.max(
      agent.minimumPrice,
      Math.round(agent.currentPrice * (1 - reduction)),
    );

    if (newPrice < agent.currentPrice) {
      return {
        shouldAdjust: true,
        newPrice,
        reason: `Low engagement (${agent.totalViews} views, ${agent.totalInquiries} inquiries). Reducing by ${(reduction * 100).toFixed(1)}%.`,
      };
    }
  }

  // Deadline pressure
  if (progress > 0.7 && agent.currentPrice > agent.minimumPrice) {
    const urgencyReduction = 0.03 + (progress - 0.7) * 0.1;
    const newPrice = Math.max(
      agent.minimumPrice,
      Math.round(agent.currentPrice * (1 - urgencyReduction)),
    );

    if (newPrice < agent.currentPrice) {
      return {
        shouldAdjust: true,
        newPrice,
        reason: `Approaching deadline (${(progress * 100).toFixed(0)}% elapsed). Reducing price to attract buyers.`,
      };
    }
  }

  return { shouldAdjust: false };
}

/** Get seasonality factor (0-1) based on month */
function getSeasonalityFactor(month: number): number {
  // General pattern: spring/fall higher, winter/summer lower
  const factors = [
    0.4, 0.45, 0.6, 0.7, 0.75, 0.65, 0.55, 0.6, 0.8, 0.75, 0.6, 0.4,
  ];
  return factors[month] ?? 0.5;
}

/** Get posting time factor (best times: Sunday evening, weekday mornings) */
function getPostingTimeFactor(): number {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // Sunday evening (peak)
  if (day === 0 && hour >= 18 && hour <= 21) return 1.0;
  // Weekday mornings
  if (day >= 1 && day <= 5 && hour >= 8 && hour <= 10) return 0.8;
  // Weekday evenings
  if (day >= 1 && day <= 5 && hour >= 18 && hour <= 21) return 0.7;
  // Saturday
  if (day === 6 && hour >= 10 && hour <= 14) return 0.6;
  // Default
  return 0.4;
}

// ──────────────────────────────────────────────
// STRATEGY-DRIVEN OFFER PROCESSING
// ──────────────────────────────────────────────

/** Build the context objects strategies need */
async function buildSellingAgentContext(
  agentId: string,
): Promise<SellingAgentContext | null> {
  const agent = await db.sellingAgent.findUnique({
    where: { id: agentId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          viewCount: true,
          createdAt: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!agent) return null;

  const listing: ListingContext = {
    id: agent.listing.id,
    title: agent.listing.title,
    price: Number(agent.listing.price),
    minimumPrice: agent.minimumPrice,
    currentPrice: agent.currentPrice ?? Number(agent.listing.price),
    urgency: agent.urgency,
    createdAt: agent.listing.createdAt,
    expiresAt: agent.listing.expiresAt,
    currency: agent.listing.currency,
    totalViews: agent.listing.viewCount ?? 0,
    totalInquiries: agent.totalInquiries ?? 0,
  };

  return {
    id: agent.id,
    listing,
    strategyConfig: agent.strategyConfig as Record<string, unknown> | null,
  };
}

/**
 * Process an incoming offer through the selling agent's strategy.
 *
 * 1. Creates an Offer record
 * 2. Supersedes any previous PENDING offer from the same buyer
 * 3. Delegates to the strategy for processing
 * 4. Updates offer status based on strategy result
 * 5. Returns a generic buyer acknowledgement (NEVER leaks price info)
 */
export async function processIncomingOffer(params: {
  sellingAgentId: string;
  listingId: string;
  buyerId: string;
  buyingAgentId?: string;
  offerPrice: number;
  message?: string;
}): Promise<BuyerOfferAck> {
  const {
    sellingAgentId,
    listingId,
    buyerId,
    buyingAgentId,
    offerPrice,
    message,
  } = params;

  // Load agent + strategy
  const agentCtx = await buildSellingAgentContext(sellingAgentId);
  if (!agentCtx) {
    return {
      message:
        "Your offer has been submitted. The seller will review it and respond.",
      status: "PENDING",
      offerId: "",
    };
  }

  const agent = await db.sellingAgent.findUnique({
    where: { id: sellingAgentId },
    select: { sellingStrategyId: true },
  });
  const strategyId: SellingStrategyId =
    agent?.sellingStrategyId ?? "SEALED_BID";
  const strategy = getSellingStrategy(strategyId);

  // Supersede any existing PENDING offer from this buyer on this listing
  const existingPending = await db.offer.findFirst({
    where: {
      listingId,
      buyerId,
      status: "PENDING",
    },
  });

  // Create the new offer
  const isAboveMinimum = offerPrice >= agentCtx.listing.minimumPrice;
  const newOffer = await db.offer.create({
    data: {
      listingId,
      buyerId,
      sellingAgentId,
      buyingAgentId: buyingAgentId ?? null,
      price: offerPrice,
      status: "PENDING",
      isAboveMinimum,
      message: message ?? null,
    },
  });

  // Supersede the old offer if there was one
  if (existingPending) {
    await db.offer.update({
      where: { id: existingPending.id },
      data: {
        status: "SUPERSEDED",
        supersededById: newOffer.id,
      },
    });
  }

  // Build offer context
  const offerCtx: OfferContext = {
    id: newOffer.id,
    price: offerPrice,
    buyerId,
    buyingAgentId: buyingAgentId ?? null,
    message: message ?? null,
    createdAt: newOffer.createdAt,
  };

  // Let strategy process the offer
  const result = await strategy.processOffer(agentCtx, offerCtx);

  // Update offer based on strategy result
  if (result.action === "accept") {
    await db.offer.update({
      where: { id: newOffer.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  } else if (result.action === "reject_silent") {
    await db.offer.update({
      where: { id: newOffer.id },
      data: { status: "REJECTED", rejectedAt: new Date() },
    });
  }
  // "pending" stays as-is

  // Mark seller notified if forwarded
  if (result.forwardToSeller) {
    await db.offer.update({
      where: { id: newOffer.id },
      data: { sellerNotifiedAt: new Date() },
    });
  }

  // Log the action
  await db.agentAction.create({
    data: {
      sellingAgentId,
      agentType: "SELLING",
      actionType: "AUTO_NEGOTIATE",
      description: result.reasoning,
      metadata: {
        offerId: newOffer.id,
        offerPrice,
        strategyId,
        action: result.action,
        isAboveMinimum,
      },
    },
  });

  // Return generic buyer ack — NEVER reveals price decisions
  return strategy.getBuyerAck(offerCtx);
}

/**
 * Get offers visible to the seller, filtered by the active strategy.
 */
export async function getSellerOffers(
  sellingAgentId: string,
): Promise<SellerOfferView[]> {
  const agentCtx = await buildSellingAgentContext(sellingAgentId);
  if (!agentCtx) return [];

  const agent = await db.sellingAgent.findUnique({
    where: { id: sellingAgentId },
    select: { sellingStrategyId: true },
  });
  const strategy = getSellingStrategy(agent?.sellingStrategyId ?? "SEALED_BID");

  const pendingOffers = await db.offer.findMany({
    where: {
      sellingAgentId,
      status: "PENDING",
      isAboveMinimum: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const offerContexts: OfferContext[] = pendingOffers.map((o) => ({
    id: o.id,
    price: o.price,
    buyerId: o.buyerId,
    buyingAgentId: o.buyingAgentId,
    message: o.message,
    createdAt: o.createdAt,
  }));

  return strategy.getSellerView(agentCtx, offerContexts);
}

/**
 * Seller manually accepts an offer.
 */
export async function acceptOffer(
  offerId: string,
  sellingAgentId: string,
): Promise<{ success: boolean; error?: string }> {
  const offer = await db.offer.findUnique({ where: { id: offerId } });
  if (!offer || offer.sellingAgentId !== sellingAgentId) {
    return { success: false, error: "Offer not found" };
  }
  if (offer.status !== "PENDING") {
    return { success: false, error: "Offer is no longer pending" };
  }

  // Accept this offer
  await db.offer.update({
    where: { id: offerId },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  // Reject all other pending offers for this listing
  await db.offer.updateMany({
    where: {
      listingId: offer.listingId,
      status: "PENDING",
      id: { not: offerId },
    },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });

  // Log
  await db.agentAction.create({
    data: {
      sellingAgentId,
      agentType: "SELLING",
      actionType: "AUTO_NEGOTIATE",
      description: `Seller accepted offer €${offer.price} from buyer.`,
      metadata: { offerId, price: offer.price, action: "seller_accept" },
    },
  });

  return { success: true };
}

/**
 * Seller manually declines an offer.
 */
export async function declineOffer(
  offerId: string,
  sellingAgentId: string,
): Promise<{ success: boolean; error?: string }> {
  const offer = await db.offer.findUnique({ where: { id: offerId } });
  if (!offer || offer.sellingAgentId !== sellingAgentId) {
    return { success: false, error: "Offer not found" };
  }
  if (offer.status !== "PENDING") {
    return { success: false, error: "Offer is no longer pending" };
  }

  await db.offer.update({
    where: { id: offerId },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });

  await db.agentAction.create({
    data: {
      sellingAgentId,
      agentType: "SELLING",
      actionType: "AUTO_NEGOTIATE",
      description: `Seller declined offer €${offer.price}.`,
      metadata: { offerId, price: offer.price, action: "seller_decline" },
    },
  });

  return { success: true };
}

/**
 * Run periodic tick for all active selling agents.
 * Called by cron — applies time-based strategy actions (e.g. Dutch auction price drops).
 */
export async function runSellingAgentTicks(): Promise<number> {
  const agents = await db.sellingAgent.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, sellingStrategyId: true },
  });

  let actionsApplied = 0;

  for (const agent of agents) {
    const strategy = getSellingStrategy(agent.sellingStrategyId);
    if (!strategy.onTick) continue;

    const ctx = await buildSellingAgentContext(agent.id);
    if (!ctx) continue;

    const actions = await strategy.onTick(ctx);
    for (const action of actions) {
      if (action.type === "PRICE_ADJUST" && action.newPrice != null) {
        await db.sellingAgent.update({
          where: { id: agent.id },
          data: { currentPrice: action.newPrice },
        });
        await db.listing.update({
          where: { id: ctx.listing.id },
          data: { price: action.newPrice },
        });
        await db.agentAction.create({
          data: {
            sellingAgentId: agent.id,
            agentType: "SELLING",
            actionType: "PRICE_ADJUST",
            description: action.reason,
            metadata: {
              newPrice: action.newPrice,
              strategyId: agent.sellingStrategyId,
            },
          },
        });
        actionsApplied++;
      }
    }
  }

  return actionsApplied;
}

/**
 * Check all active agents approaching deadline and prompt sellers.
 */
export async function checkDeadlines(): Promise<number> {
  const agents = await db.sellingAgent.findMany({
    where: { status: "ACTIVE" },
    include: {
      listing: { select: { id: true, expiresAt: true } },
    },
  });

  let notifications = 0;

  for (const agent of agents) {
    if (!agent.listing.expiresAt) continue;

    const hoursLeft =
      (agent.listing.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    // Only prompt in last 24 hours
    if (hoursLeft > 24 || hoursLeft < 0) continue;

    const strategy = getSellingStrategy(agent.sellingStrategyId);
    if (!strategy.onDeadlineApproaching) continue;

    const ctx = await buildSellingAgentContext(agent.id);
    if (!ctx) continue;

    const pendingOffers = await db.offer.findMany({
      where: {
        sellingAgentId: agent.id,
        status: "PENDING",
        isAboveMinimum: true,
      },
    });

    const offerContexts: OfferContext[] = pendingOffers.map((o) => ({
      id: o.id,
      price: o.price,
      buyerId: o.buyerId,
      buyingAgentId: o.buyingAgentId,
      message: o.message,
      createdAt: o.createdAt,
    }));

    const deadlineAction = await strategy.onDeadlineApproaching(
      ctx,
      offerContexts,
    );
    if (deadlineAction) {
      await db.agentAction.create({
        data: {
          sellingAgentId: agent.id,
          agentType: "SELLING",
          actionType: "NOTIFICATION",
          description: deadlineAction.message,
          metadata: {
            type: "deadline_approaching",
            offerCount: deadlineAction.offerCount,
            bestOfferPrice: deadlineAction.bestOfferPrice,
          },
        },
      });
      notifications++;
    }
  }

  return notifications;
}

// Re-export types for convenience
export type {
  BuyerOfferAck,
  SellerOfferView,
  OfferContext,
  TickAction,
  DeadlineAction,
};

// ──────────────────────────────────────────────
// AUTO-BOOST
// ──────────────────────────────────────────────

export interface BoostRecommendation {
  shouldBoost: boolean;
  reason: string;
  estimatedReachIncrease: number; // percentage
  suggestedDuration: number; // hours
}

/** Determine if listing should be boosted based on engagement metrics */
export function shouldBoost(params: {
  totalViews: number;
  totalInquiries: number;
  daysActive: number;
  urgency: string;
  currentlyBoosted: boolean;
  previousBoosts: number;
}): BoostRecommendation {
  const {
    totalViews,
    totalInquiries,
    daysActive,
    urgency,
    currentlyBoosted,
    previousBoosts,
  } = params;

  if (currentlyBoosted) {
    return {
      shouldBoost: false,
      reason: "Already boosted",
      estimatedReachIncrease: 0,
      suggestedDuration: 0,
    };
  }

  if (previousBoosts >= 3) {
    return {
      shouldBoost: false,
      reason: "Maximum boost limit reached",
      estimatedReachIncrease: 0,
      suggestedDuration: 0,
    };
  }

  const urgencyDays = (URGENCY_HOURS[urgency] || 168) / 24;
  const progress = daysActive / urgencyDays;
  const dailyViews = daysActive > 0 ? totalViews / daysActive : 0;
  const viewToInquiry = totalViews > 0 ? totalInquiries / totalViews : 0;

  // Low visibility — not enough views
  if (daysActive >= 1 && dailyViews < 5) {
    return {
      shouldBoost: true,
      reason: `Low visibility: only ${dailyViews.toFixed(1)} views/day. Boost will increase reach.`,
      estimatedReachIncrease: 200,
      suggestedDuration: 24,
    };
  }

  // Good views but no inquiries — listing needs more exposure
  if (totalViews > 20 && viewToInquiry < 0.01) {
    return {
      shouldBoost: true,
      reason: `${totalViews} views but only ${totalInquiries} inquiries. Boost to reach different audience.`,
      estimatedReachIncrease: 150,
      suggestedDuration: 12,
    };
  }

  // Urgency pressure — past 60% of deadline
  if (progress > 0.6 && totalInquiries < 2) {
    return {
      shouldBoost: true,
      reason: `${(progress * 100).toFixed(0)}% of selling window elapsed with minimal interest. Boost for final push.`,
      estimatedReachIncrease: 250,
      suggestedDuration: 48,
    };
  }

  return {
    shouldBoost: false,
    reason: "Engagement metrics are adequate. No boost needed.",
    estimatedReachIncrease: 0,
    suggestedDuration: 0,
  };
}

// ──────────────────────────────────────────────
// DAILY SUMMARY
// ──────────────────────────────────────────────

export interface DailySummary {
  agentId: string;
  listingTitle: string;
  date: string;
  metrics: {
    views: number;
    inquiries: number;
    offers: number;
    priceChanges: number;
  };
  highlights: string[];
  recommendations: string[];
  pricingStatus: {
    currentPrice: number;
    originalPrice: number;
    changePercent: number;
    nextAdjustment?: { price: number; dayOffset: number };
  };
}

/** Generate a daily summary for a selling agent */
export async function generateDailySummary(
  agentId: string,
): Promise<DailySummary | null> {
  const agent = await db.sellingAgent.findUnique({
    where: { id: agentId },
    include: {
      listing: {
        select: {
          title: true,
          price: true,
          currency: true,
          viewCount: true,
        },
      },
      actions: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!agent) return null;

  const todayActions = agent.actions;
  const priceChanges = todayActions.filter(
    (a) => a.actionType === "PRICE_ADJUST",
  );
  const responses = todayActions.filter((a) => a.actionType === "AUTO_RESPOND");
  const negotiations = todayActions.filter(
    (a) => a.actionType === "AUTO_NEGOTIATE",
  );

  const highlights: string[] = [];
  const recommendations: string[] = [];

  if (todayActions.length === 0) {
    highlights.push("Quiet day — no significant activity");
    recommendations.push(
      "Consider sharing your listing link on social media for more visibility",
    );
  } else {
    if (responses.length > 0)
      highlights.push(
        `Answered ${responses.length} buyer question(s) automatically`,
      );
    if (negotiations.length > 0)
      highlights.push(`Handled ${negotiations.length} negotiation(s)`);
    if (priceChanges.length > 0)
      highlights.push(`Made ${priceChanges.length} price adjustment(s)`);
  }

  const originalPrice = agent.startingPrice ?? Number(agent.listing.price);
  const changePercent =
    originalPrice > 0
      ? ((Number(agent.listing.price) - originalPrice) / originalPrice) * 100
      : 0;

  return {
    agentId,
    listingTitle: agent.listing.title,
    date: new Date().toISOString().split("T")[0],
    metrics: {
      views: agent.listing.viewCount ?? 0,
      inquiries: responses.length,
      offers: negotiations.length,
      priceChanges: priceChanges.length,
    },
    highlights,
    recommendations,
    pricingStatus: {
      currentPrice: Number(agent.listing.price),
      originalPrice,
      changePercent: Math.round(changePercent * 10) / 10,
    },
  };
}
