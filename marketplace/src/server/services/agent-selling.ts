/**
 * Selling Agent Service — Pricing strategy, auto-adjust, auto-respond
 * Manages the lifecycle of a selling agent from creation to sale
 */

import { db } from "@/server/db";
import { aiComplete, createMessages } from "./ai";
import { URGENCY_HOURS } from "@/lib/constants";
import type { PricingFactors, PricingCurvePoint } from "@/types";

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
    condition: params.condition === "NEW" ? 1 : params.condition === "REFURBISHED" ? 0.7 : 0.5,
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
    urgencyHours / 24 // days
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
  totalDays: number
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
    else if (progress < 0.3) reason = "Slight adjustment — testing market response";
    else if (progress < 0.7) reason = "Moderate reduction — increasing competitiveness";
    else reason = "Aggressive pricing — approaching deadline";

    curve.push({ day, price, reason });
  }

  return curve;
}

/** Auto-respond to common buyer questions */
export async function generateAutoResponse(
  questionText: string,
  listingTitle: string,
  listingDescription: string
): Promise<string | null> {
  const messages = createMessages(
    `You are a helpful selling assistant for a classifieds listing.
Listing: "${listingTitle}"
Description: "${listingDescription}"

If the buyer's question is a common FAQ (availability, condition, price negotiation, meeting location), 
provide a brief, friendly response. If the question requires the seller's personal input, return null.
Respond directly as if you are the seller's assistant.`,
    questionText
  );

  try {
    const result = await aiComplete({ messages, temperature: 0.5, maxTokens: 200 });
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
  const daysActive = (Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const urgencyDays = (URGENCY_HOURS[agent.urgency] || 168) / 24;
  const progress = daysActive / urgencyDays;
  const viewToInquiryRatio = agent.totalViews > 0 ? agent.totalInquiries / agent.totalViews : 0;

  // Low engagement trigger
  if (progress > 0.3 && viewToInquiryRatio < 0.02 && agent.currentPrice > agent.minimumPrice) {
    const reduction = Math.min(0.05, progress * 0.1); // Max 5% reduction per adjustment
    const newPrice = Math.max(
      agent.minimumPrice,
      Math.round(agent.currentPrice * (1 - reduction))
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
      Math.round(agent.currentPrice * (1 - urgencyReduction))
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
  const factors = [0.4, 0.45, 0.6, 0.7, 0.75, 0.65, 0.55, 0.6, 0.8, 0.75, 0.6, 0.4];
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
// AUTO-NEGOTIATE
// ──────────────────────────────────────────────

export interface NegotiationRules {
  minPrice: number;
  autoAcceptAbove: number;
  maxCounterRounds: number;
  concessionRate: number; // 0-1: how much to concede per round
}

export interface NegotiationResult {
  action: "accept" | "counter" | "reject" | "escalate";
  counterPrice?: number;
  message: string;
  reasoning: string;
}

/** Evaluate an incoming offer and decide how to respond */
export async function evaluateOffer(params: {
  offerPrice: number;
  currentPrice: number;
  rules: NegotiationRules;
  roundNumber: number;
  listingTitle: string;
  buyerMessage?: string;
}): Promise<NegotiationResult> {
  const { offerPrice, currentPrice, rules, roundNumber, listingTitle, buyerMessage } = params;

  // Auto-accept if above threshold
  if (offerPrice >= rules.autoAcceptAbove) {
    return {
      action: "accept",
      message: `Great, I accept your offer of €${offerPrice} for "${listingTitle}". Let's arrange the details!`,
      reasoning: `Offer €${offerPrice} >= auto-accept threshold €${rules.autoAcceptAbove}`,
    };
  }

  // Reject if below minimum
  if (offerPrice < rules.minPrice) {
    return {
      action: "reject",
      message: `Thanks for your interest, but I can't go that low. The lowest I can consider is closer to €${Math.round(rules.minPrice * 1.05)}.`,
      reasoning: `Offer €${offerPrice} < minimum €${rules.minPrice}`,
    };
  }

  // Max rounds exceeded — escalate to seller
  if (roundNumber >= rules.maxCounterRounds) {
    return {
      action: "escalate",
      message: `Let me check with the seller and get back to you about the €${offerPrice} offer.`,
      reasoning: `Max negotiation rounds (${rules.maxCounterRounds}) reached. Escalating to seller.`,
    };
  }

  // Counter-offer logic
  const gap = currentPrice - offerPrice;
  const concession = gap * rules.concessionRate * (1 + roundNumber * 0.1);
  const counterPrice = Math.max(
    rules.minPrice,
    Math.round(currentPrice - concession)
  );

  // If counter would be close to the offer, just accept
  if (counterPrice - offerPrice < currentPrice * 0.02) {
    return {
      action: "accept",
      counterPrice: offerPrice,
      message: `You've got a deal at €${offerPrice}! Let's connect to finalize.`,
      reasoning: `Counter would be only €${counterPrice - offerPrice} above offer. Accepting to close.`,
    };
  }

  // Try AI-generated counter message
  try {
    const messages = createMessages(
      `You are a friendly but firm negotiation assistant for a classifieds listing.
Item: "${listingTitle}", Listed at €${currentPrice}.
The buyer offered €${offerPrice}. You want to counter at €${counterPrice}.
Write a brief, friendly counter-offer message. Be warm but hold firm.
${buyerMessage ? `Buyer said: "${buyerMessage}"` : ""}`,
      `Generate a counter-offer response.`
    );
    const result = await aiComplete({ messages, temperature: 0.6, maxTokens: 150 });
    return {
      action: "counter",
      counterPrice,
      message: result.content,
      reasoning: `Round ${roundNumber + 1}: Counter at €${counterPrice} (concession: €${Math.round(concession)})`,
    };
  } catch {
    return {
      action: "counter",
      counterPrice,
      message: `I appreciate the offer! I could meet you at €${counterPrice}. What do you think?`,
      reasoning: `Round ${roundNumber + 1}: Counter at €${counterPrice} (AI unavailable, using template)`,
    };
  }
}

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
  const { totalViews, totalInquiries, daysActive, urgency, currentlyBoosted, previousBoosts } = params;

  if (currentlyBoosted) {
    return { shouldBoost: false, reason: "Already boosted", estimatedReachIncrease: 0, suggestedDuration: 0 };
  }

  if (previousBoosts >= 3) {
    return { shouldBoost: false, reason: "Maximum boost limit reached", estimatedReachIncrease: 0, suggestedDuration: 0 };
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
export async function generateDailySummary(agentId: string): Promise<DailySummary | null> {
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
  const priceChanges = todayActions.filter((a) => a.actionType === "PRICE_ADJUST");
  const responses = todayActions.filter((a) => a.actionType === "AUTO_RESPOND");
  const negotiations = todayActions.filter((a) => a.actionType === "AUTO_NEGOTIATE");

  const highlights: string[] = [];
  const recommendations: string[] = [];

  if (todayActions.length === 0) {
    highlights.push("Quiet day — no significant activity");
    recommendations.push("Consider sharing your listing link on social media for more visibility");
  } else {
    if (responses.length > 0) highlights.push(`Answered ${responses.length} buyer question(s) automatically`);
    if (negotiations.length > 0) highlights.push(`Handled ${negotiations.length} negotiation(s)`);
    if (priceChanges.length > 0) highlights.push(`Made ${priceChanges.length} price adjustment(s)`);
  }

  const originalPrice = agent.startingPrice ?? agent.listing.price;
  const changePercent = originalPrice > 0
    ? ((agent.listing.price - originalPrice) / originalPrice) * 100
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
      currentPrice: agent.listing.price,
      originalPrice,
      changePercent: Math.round(changePercent * 10) / 10,
    },
  };
}
