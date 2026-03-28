/**
 * Buying Agent Service — Monitor listings, score deals, strategy-aware bidding
 */

import { db } from '@/server/db';
import type { Prisma } from '@prisma/client';
import type { DealScoreBreakdown } from '@/types';
import { getBuyingStrategy } from './strategies/registry';
import { processIncomingOffer } from './agent-selling';
import type { BuyingAgentContext, ListingContext, OfferContext } from './strategies/types';
import { URGENCY_HOURS } from '@/lib/constants';

/** Calculate deal score (0-100) for a listing match */
export async function calculateDealScore(params: {
  listingId: string;
  categoryId: string;
  targetPrice: number;
  maxBudget: number;
  locationId?: string;
  subcategorySlug?: string;
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
      priceVsMarket: 0,
      timeOnMarket: 0,
      sellerUrgency: 0,
      listingQuality: 0,
      sellerReputation: 0,
      locationConvenience: 0,
      conditionVsPrice: 0,
      total: 0,
    };
  }

  // Get market data — prefer subcategory snapshot for more accurate scoring
  let snapshot = params.subcategorySlug
    ? await db.marketSnapshot.findFirst({
        where: {
          categoryId: params.categoryId,
          subcategorySlug: params.subcategorySlug,
        },
        orderBy: { date: 'desc' },
      })
    : null;

  if (!snapshot) {
    snapshot = await db.marketSnapshot.findFirst({
      where: { categoryId: params.categoryId },
      orderBy: { date: 'desc' },
    });
  }

  const medianPrice = snapshot?.medianPrice ?? Number(listing.price);

  // 1. Price vs Market (0-30 points)
  const priceRatio = Number(listing.price) / medianPrice;
  const priceVsMarket = Math.round(Math.max(0, Math.min(30, (1.3 - priceRatio) * 30)));

  // 2. Time on Market (0-15 points) — longer = better for buyer
  const daysListed = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const timeOnMarket = Math.round(Math.min(15, daysListed * 0.5));

  // 3. Seller Urgency Signals (0-15 points)
  const hasSellingAgent = listing.managedByAgent;
  const sellerUrgency = hasSellingAgent ? 10 : listing.negotiable ? 8 : 3;

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
  if (listing.condition === 'NEW' && Number(listing.price) < medianPrice) conditionVsPrice = 10;
  if (listing.condition === 'USED' && Number(listing.price) < medianPrice * 0.7)
    conditionVsPrice = 8;

  const total = Math.min(
    100,
    priceVsMarket +
      timeOnMarket +
      sellerUrgency +
      listingQuality +
      sellerReputation +
      locationConvenience +
      conditionVsPrice,
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

  if (!agent || agent.status !== 'ACTIVE') return 0;

  const criteria = agent.searchCriteria as Record<string, unknown>;
  const existingMatchIds = agent.matches.map((m) => m.listingId);

  // Build query from criteria
  const where: Prisma.ListingWhereInput = {
    status: 'ACTIVE',
    id: { notIn: existingMatchIds },
    price: { lte: agent.maxBudget },
  };

  if (criteria.categoryId) where.categoryId = criteria.categoryId as string;
  if (criteria.locationId) where.locationId = criteria.locationId as string;
  if (criteria.condition) where.condition = criteria.condition as Prisma.EnumListingConditionFilter;
  if (criteria.minPrice) {
    where.price = {
      ...((where.price as object) || {}),
      gte: criteria.minPrice as number,
    };
  }
  if (criteria.keywords) {
    where.OR = [
      { title: { contains: criteria.keywords as string, mode: 'insensitive' } },
      {
        description: {
          contains: criteria.keywords as string,
          mode: 'insensitive',
        },
      },
    ];
  }

  // Find new matches
  const listings = await db.listing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
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
          analysis: JSON.parse(JSON.stringify(score)),
          status: 'NEW',
        },
      });

      // Log the action
      await db.agentAction.create({
        data: {
          buyingAgentId: agent.id,
          agentType: 'BUYING',
          actionType: 'MATCH_FOUND',
          description: `Found match: "${listing.title}" — Deal Score: ${score.total}/100`,
          metadata: {
            listingId: listing.id,
            price: Number(listing.price),
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
// ──────────────────────────────────────────────
// STRATEGY-AWARE BIDDING
// ──────────────────────────────────────────────

/** Build a BuyingAgentContext from a DB record */
function buildBuyingAgentContext(agent: {
  id: string;
  maxBudget: number;
  targetPrice: number | null;
  strategyConfig: unknown;
  createdAt: Date;
}): BuyingAgentContext {
  return {
    id: agent.id,
    maxBudget: agent.maxBudget,
    targetPrice: agent.targetPrice,
    strategyConfig: agent.strategyConfig as Record<string, unknown> | null,
    createdAt: agent.createdAt,
  };
}

/** Build a ListingContext from a DB record */
function buildListingContext(listing: {
  id: string;
  title: string;
  price: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  viewCount: number;
  currency: string;
  sellingAgent?: {
    urgency: string;
    currentPrice: number | null;
    minimumPrice: number;
    totalInquiries: number | null;
  } | null;
}): ListingContext {
  const urgency = listing.sellingAgent?.urgency ?? 'ONE_WEEK';
  return {
    id: listing.id,
    title: listing.title,
    price: Number(listing.price),
    minimumPrice: listing.sellingAgent?.minimumPrice ?? Number(listing.price),
    currentPrice: listing.sellingAgent?.currentPrice ?? Number(listing.price),
    urgency,
    createdAt: listing.createdAt,
    expiresAt: listing.expiresAt,
    currency: listing.currency,
    totalViews: listing.viewCount ?? 0,
    totalInquiries: listing.sellingAgent?.totalInquiries ?? 0,
  };
}

/**
 * Execute strategy-based bidding for a buying agent on its matches.
 * Called after monitorForMatches finds new matches.
 */
export async function executeBuyingStrategy(buyingAgentId: string): Promise<number> {
  const agent = await db.buyingAgent.findUnique({
    where: { id: buyingAgentId },
    include: {
      matches: {
        where: { status: 'NEW', autoOfferSent: false },
        include: {
          listing: {
            include: {
              sellingAgent: {
                select: {
                  id: true,
                  urgency: true,
                  currentPrice: true,
                  minimumPrice: true,
                  totalInquiries: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!agent || agent.status !== 'ACTIVE') return 0;

  const strategy = getBuyingStrategy(agent.buyingStrategyId);
  const agentCtx = buildBuyingAgentContext(agent);

  let offersSent = 0;

  for (const match of agent.matches) {
    const listingCtx = buildListingContext(match.listing);

    const bid = strategy.calculateBid(agentCtx, listingCtx, match.dealScore);
    if (!bid) continue;

    // Only bid if there's a selling agent to receive it
    if (!match.listing.sellingAgent) continue;

    // Submit the offer through the selling agent's strategy
    await processIncomingOffer({
      sellingAgentId: match.listing.sellingAgent.id,
      listingId: match.listingId,
      buyerId: agent.userId,
      buyingAgentId: agent.id,
      offerPrice: bid.price,
      message: bid.message,
    });

    // Mark match as offer sent
    await db.agentMatch.update({
      where: { id: match.id },
      data: {
        autoOfferSent: true,
        offerPrice: bid.price,
        status: 'OFFERED',
      },
    });

    // Log
    await db.agentAction.create({
      data: {
        buyingAgentId: agent.id,
        agentType: 'BUYING',
        actionType: 'AUTO_NEGOTIATE',
        description: bid.reasoning,
        metadata: {
          listingId: match.listingId,
          offerPrice: bid.price,
          dealScore: match.dealScore,
          strategyId: agent.buyingStrategyId,
        },
      },
    });

    offersSent++;
  }

  return offersSent;
}

/**
 * Check if any existing offers from buying agents should be escalated.
 * Called periodically by cron.
 */
export async function escalateBuyingOffers(): Promise<number> {
  const agents = await db.buyingAgent.findMany({
    where: { status: 'ACTIVE' },
    include: {
      offers: {
        where: { status: 'PENDING' },
        include: {
          listing: {
            include: {
              sellingAgent: {
                select: {
                  id: true,
                  urgency: true,
                  currentPrice: true,
                  minimumPrice: true,
                  totalInquiries: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let escalations = 0;

  for (const agent of agents) {
    const strategy = getBuyingStrategy(agent.buyingStrategyId);
    if (!strategy.shouldEscalate) continue;

    const agentCtx = buildBuyingAgentContext(agent);

    for (const offer of agent.offers) {
      const listingCtx = buildListingContext(offer.listing);
      const offerCtx: OfferContext = {
        id: offer.id,
        price: offer.price,
        buyerId: offer.buyerId,
        buyingAgentId: offer.buyingAgentId,
        message: offer.message,
        createdAt: offer.createdAt,
      };

      const decision = strategy.shouldEscalate(agentCtx, listingCtx, offerCtx);
      if (!decision?.shouldEscalate || !decision.newPrice) continue;

      // Submit a new (escalated) offer — this will auto-supersede the old one
      if (offer.listing.sellingAgent) {
        await processIncomingOffer({
          sellingAgentId: offer.listing.sellingAgent.id,
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          buyingAgentId: agent.id,
          offerPrice: decision.newPrice,
        });

        await db.agentAction.create({
          data: {
            buyingAgentId: agent.id,
            agentType: 'BUYING',
            actionType: 'AUTO_NEGOTIATE',
            description: decision.reasoning,
            metadata: {
              listingId: offer.listingId,
              oldPrice: offer.price,
              newPrice: decision.newPrice,
              strategyId: agent.buyingStrategyId,
            },
          },
        });

        escalations++;
      }
    }
  }

  return escalations;
}
