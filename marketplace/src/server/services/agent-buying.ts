/**
 * Buying Agent Service — Monitor listings, score deals, auto-negotiate
 */

import { db } from "@/server/db";
import type { DealScoreBreakdown } from "@/types";

/** Calculate deal score (0-100) for a listing match */
export async function calculateDealScore(params: {
  listingId: string;
  categoryId: string;
  targetPrice: number;
  maxBudget: number;
  locationId?: string;
}): Promise<DealScoreBreakdown> {
  const listing = await db.listing.findUnique({
    where: { id: params.listingId },
    include: {
      user: { select: { _count: { select: { reviewsReceived: true } } } },
      images: true,
    },
  });

  if (!listing) {
    return {
      priceVsMarket: 0, timeOnMarket: 0, sellerUrgency: 0,
      listingQuality: 0, sellerReputation: 0, locationConvenience: 0,
      conditionVsPrice: 0, total: 0,
    };
  }

  // Get market data
  const snapshot = await db.marketSnapshot.findFirst({
    where: { categoryId: params.categoryId },
    orderBy: { date: "desc" },
  });

  const medianPrice = snapshot?.medianPrice ?? listing.price;

  // 1. Price vs Market (0-30 points)
  const priceRatio = listing.price / medianPrice;
  const priceVsMarket = Math.round(Math.max(0, Math.min(30, (1.3 - priceRatio) * 30)));

  // 2. Time on Market (0-15 points) — longer = better for buyer
  const daysListed = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const timeOnMarket = Math.round(Math.min(15, daysListed * 0.5));

  // 3. Seller Urgency Signals (0-15 points)
  const hasSellingAgent = listing.managedByAgent;
  const sellerUrgency = hasSellingAgent ? 10 : (listing.negotiable ? 8 : 3);

  // 4. Listing Quality (0-10 points)
  const hasImages = listing.images.length > 0;
  const hasDescription = listing.description.length > 100;
  const listingQuality = (hasImages ? 5 : 0) + (hasDescription ? 5 : 0);

  // 5. Seller Reputation (0-10 points)
  const reviewCount = listing.user._count.reviewsReceived;
  const sellerReputation = Math.min(10, reviewCount * 2);

  // 6. Location Convenience (0-10 points) — simplified
  const locationConvenience = params.locationId === listing.locationId ? 10 : 5;

  // 7. Condition vs Price (0-10 points)
  let conditionVsPrice = 5;
  if (listing.condition === "NEW" && listing.price < medianPrice) conditionVsPrice = 10;
  if (listing.condition === "USED" && listing.price < medianPrice * 0.7) conditionVsPrice = 8;

  const total = Math.min(
    100,
    priceVsMarket + timeOnMarket + sellerUrgency + listingQuality +
    sellerReputation + locationConvenience + conditionVsPrice
  );

  return {
    priceVsMarket,
    timeOnMarket,
    sellerUrgency,
    listingQuality,
    sellerReputation,
    locationConvenience,
    conditionVsPrice,
    total,
  };
}

/** Monitor listings for buying agent matches */
export async function monitorForMatches(buyingAgentId: string): Promise<number> {
  const agent = await db.buyingAgent.findUnique({
    where: { id: buyingAgentId },
    include: { matches: { select: { listingId: true } } },
  });

  if (!agent || agent.status !== "ACTIVE") return 0;

  const criteria = agent.searchCriteria as Record<string, unknown>;
  const existingMatchIds = agent.matches.map((m) => m.listingId);

  // Build query from criteria
  const where: Record<string, unknown> = {
    status: "ACTIVE",
    id: { notIn: existingMatchIds },
    price: { lte: agent.maxBudget },
  };

  if (criteria.categoryId) where.categoryId = criteria.categoryId;
  if (criteria.locationId) where.locationId = criteria.locationId;
  if (criteria.condition) where.condition = criteria.condition;
  if (criteria.minPrice) {
    where.price = { ...((where.price as object) || {}), gte: criteria.minPrice as number };
  }
  if (criteria.keywords) {
    where.OR = [
      { title: { contains: criteria.keywords as string, mode: "insensitive" } },
      { description: { contains: criteria.keywords as string, mode: "insensitive" } },
    ];
  }

  // Find new matches
  const listings = await db.listing.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let newMatches = 0;

  for (const listing of listings) {
    const score = await calculateDealScore({
      listingId: listing.id,
      categoryId: listing.categoryId,
      targetPrice: agent.targetPrice ?? agent.maxBudget,
      maxBudget: agent.maxBudget,
      locationId: criteria.locationId as string | undefined,
    });

    // Only create matches above threshold
    if (score.total >= 30) {
      await db.agentMatch.create({
        data: {
          buyingAgentId: agent.id,
          listingId: listing.id,
          dealScore: score.total,
          analysis: score as unknown as Record<string, unknown>,
          status: "NEW",
        },
      });

      // Log the action
      await db.agentAction.create({
        data: {
          buyingAgentId: agent.id,
          agentType: "BUYING",
          actionType: "MATCH_FOUND",
          description: `Found match: "${listing.title}" — Deal Score: ${score.total}/100`,
          metadata: {
            listingId: listing.id,
            price: listing.price,
            dealScore: score.total,
          },
        },
      });

      newMatches++;
    }
  }

  // Update agent stats
  if (newMatches > 0) {
    await db.buyingAgent.update({
      where: { id: buyingAgentId },
      data: { matchCount: { increment: newMatches } },
    });
  }

  return newMatches;
}
