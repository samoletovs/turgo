/**
 * Swap/Barter Agent — Find swap opportunities between listings
 *
 * For a given listing, finds other listings where:
 *   (a) The other owner has searched for items in YOUR listing's category
 *   (b) Their listing is in a category YOU have searched for
 *
 * Proposes swap with cash difference based on MarketSnapshot valuations.
 */

import { db } from "@/server/db";
import { getMarketStats } from "./agent-pricing";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface SwapCandidate {
  /** The other listing to swap with */
  listing: {
    id: string;
    title: string;
    price: number;
    currency: string;
    condition: string;
    categoryId: string;
    categoryName: string;
    locationId: string | null;
    imageUrl: string | null;
    userId: string;
    userName: string | null;
  };
  /** How well this matches (0-100) */
  matchScore: number;
  /** Market valuation of the other listing */
  marketValuation: number;
  /** Cash difference: positive = you pay extra, negative = they pay extra */
  cashDifference: number;
  /** Why this swap was suggested */
  reasons: string[];
  /** Signals that the other party wants what you have */
  demandSignals: DemandSignal[];
}

export interface SwapProposal {
  myListingId: string;
  theirListingId: string;
  myMarketValue: number;
  theirMarketValue: number;
  cashDifference: number;
  message: string;
}

export interface DemandSignal {
  type: "search_match" | "saved_search" | "category_interest" | "favorite";
  description: string;
  strength: number; // 0-1
}

export interface SwapSearchResult {
  myListing: {
    id: string;
    title: string;
    price: number;
    marketValuation: number;
  };
  candidates: SwapCandidate[];
  totalFound: number;
}

// ──────────────────────────────────────────────
// MAIN: FIND SWAP CANDIDATES
// ──────────────────────────────────────────────

/**
 * Find swap candidates for a given listing.
 *
 * Strategy:
 *   1. Find users who searched for items in this listing's category (demand signal)
 *   2. Those users' active listings → potential swap items
 *   3. Filter to categories the current user has shown interest in
 *   4. Score by match quality + value proximity
 *   5. Calculate cash difference from MarketSnapshot valuations
 */
export async function findSwapCandidates(
  listingId: string,
  userId: string,
  limit = 20,
): Promise<SwapSearchResult> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { select: { url: true }, take: 1 },
    },
  });

  if (!listing || listing.userId !== userId) {
    throw new Error("Listing not found or not owned by user");
  }

  const categoryName =
    (listing.category.name as Record<string, string>)?.en ?? "Unknown";

  // Get market valuation for my listing
  const myMarketStats = await getMarketStats(
    listing.categoryId,
    listing.locationId ?? undefined,
  );
  const myMarketValuation = myMarketStats?.medianPrice ?? listing.price;

  // ── Step 1: Find users who searched for my listing's category ──
  const searchersForMyCategory = await db.searchLog.findMany({
    where: {
      userId: { not: userId },
      query: {
        contains: listing.category.slug,
        mode: "insensitive",
      },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
    distinct: ["userId"],
    take: 100,
  });

  // Also check saved searches targeting my category
  const savedSearchUsers = await db.savedSearch.findMany({
    where: {
      userId: { not: userId },
      filters: {
        path: ["categoryId"],
        equals: listing.categoryId,
      },
    },
    select: { userId: true },
    distinct: ["userId"],
    take: 50,
  });

  // Combine demand signal users
  const demandUserIds = new Set<string>();
  for (const s of searchersForMyCategory) {
    if (s.userId) demandUserIds.add(s.userId);
  }
  for (const s of savedSearchUsers) {
    demandUserIds.add(s.userId);
  }

  // ── Step 2: Find categories I'm interested in ──
  const mySearches = await db.searchLog.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { query: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mySavedSearches = await db.savedSearch.findMany({
    where: { userId },
    select: { filters: true },
  });

  const myFavorites = await db.favorite.findMany({
    where: { userId },
    include: {
      listing: { select: { categoryId: true } },
    },
    take: 50,
  });

  // Collect category IDs I'm interested in
  const myInterestCategories = new Set<string>();
  for (const ss of mySavedSearches) {
    const filters = ss.filters as Record<string, unknown>;
    if (filters?.categoryId && typeof filters.categoryId === "string") {
      myInterestCategories.add(filters.categoryId);
    }
  }
  for (const fav of myFavorites) {
    if (fav.listing.categoryId) {
      myInterestCategories.add(fav.listing.categoryId);
    }
  }

  // ── Step 3: Find swap-eligible listings ──
  // Priority: listings from users who want my category, in categories I want
  const whereConditions: Parameters<typeof db.listing.findMany>[0] = {
    where: {
      status: "ACTIVE",
      id: { not: listingId },
      userId: { not: userId },
      // At least one signal must match
      OR: [
        // Their listings, if they searched for my category
        ...(demandUserIds.size > 0
          ? [{ userId: { in: Array.from(demandUserIds) } }]
          : []),
        // Listings in categories I'm interested in
        ...(myInterestCategories.size > 0
          ? [{ categoryId: { in: Array.from(myInterestCategories) } }]
          : []),
      ],
    },
    include: {
      category: { select: { id: true, name: true } },
      images: { select: { url: true }, take: 1 },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3, // over-fetch for scoring
  };

  // If no signals at all, broaden search to nearby price range
  const hasSignals = demandUserIds.size > 0 || myInterestCategories.size > 0;
  if (!hasSignals) {
    whereConditions.where = {
      status: "ACTIVE",
      id: { not: listingId },
      userId: { not: userId },
      price: {
        gte: listing.price * 0.3,
        lte: listing.price * 3,
      },
    };
  }

  const potentialSwaps = await db.listing.findMany(
    whereConditions as Parameters<typeof db.listing.findMany>[0],
  );

  // ── Step 4: Score and rank candidates ──
  const candidates: SwapCandidate[] = [];

  for (const swap of potentialSwaps) {
    const swapUser = (
      swap as unknown as { user: { id: string; name: string | null } }
    ).user;
    const swapCategory = (
      swap as unknown as {
        category: { id: string; name: Record<string, string> };
      }
    ).category;
    const swapImages = (swap as unknown as { images: Array<{ url: string }> })
      .images;
    const swapCategoryName =
      (swapCategory.name as Record<string, string>)?.en ?? "Unknown";

    // Calculate demand signals
    const signals: DemandSignal[] = [];

    // Signal: they searched for my category
    if (demandUserIds.has(swapUser.id)) {
      const isFromSearch = [...searchersForMyCategory].some(
        (s) => s.userId === swapUser.id,
      );
      const isFromSaved = [...savedSearchUsers].some(
        (s) => s.userId === swapUser.id,
      );

      if (isFromSearch) {
        signals.push({
          type: "search_match",
          description: `Owner searched for "${categoryName}" items recently`,
          strength: 0.7,
        });
      }
      if (isFromSaved) {
        signals.push({
          type: "saved_search",
          description: `Owner has a saved search for "${categoryName}"`,
          strength: 0.9,
        });
      }
    }

    // Signal: listing is in a category I want
    if (myInterestCategories.has(swap.categoryId)) {
      signals.push({
        type: "category_interest",
        description: `You've shown interest in "${swapCategoryName}"`,
        strength: 0.6,
      });
    }

    // Signal: I favorited something in this category
    if (myFavorites.some((f) => f.listing.categoryId === swap.categoryId)) {
      signals.push({
        type: "favorite",
        description: `You've favorited items in "${swapCategoryName}"`,
        strength: 0.5,
      });
    }

    if (signals.length === 0) continue; // No demand signals, skip

    // Get market valuation for swap listing
    const swapMarketStats = await getMarketStats(
      swap.categoryId,
      swap.locationId ?? undefined,
    );
    const swapMarketValue = swapMarketStats?.medianPrice ?? swap.price;

    // Cash difference (positive = I pay extra)
    const cashDifference = Math.round(swapMarketValue - myMarketValuation);

    // Match score
    const signalScore = Math.min(
      1,
      signals.reduce((sum, s) => sum + s.strength, 0),
    );
    const valueSimilarity =
      1 -
      Math.min(
        1,
        Math.abs(myMarketValuation - swapMarketValue) /
          Math.max(myMarketValuation, swapMarketValue, 1),
      );
    const bidirectional =
      signals.some(
        (s) => s.type === "search_match" || s.type === "saved_search",
      ) &&
      signals.some(
        (s) => s.type === "category_interest" || s.type === "favorite",
      )
        ? 1
        : 0;

    const matchScore = Math.round(
      signalScore * 40 + valueSimilarity * 35 + bidirectional * 25,
    );

    // Build reasons
    const reasons: string[] = signals.map((s) => s.description);
    if (valueSimilarity > 0.8) {
      reasons.push("Similar market value — fair swap with minimal cash");
    }
    if (bidirectional) {
      reasons.push("Mutual interest detected — high swap potential!");
    }

    candidates.push({
      listing: {
        id: swap.id,
        title: swap.title,
        price: swap.price,
        currency: swap.currency,
        condition: swap.condition,
        categoryId: swap.categoryId,
        categoryName: swapCategoryName,
        locationId: swap.locationId,
        imageUrl: swapImages[0]?.url ?? null,
        userId: swapUser.id,
        userName: swapUser.name,
      },
      matchScore,
      marketValuation: Math.round(swapMarketValue),
      cashDifference,
      reasons,
      demandSignals: signals,
    });
  }

  // Sort by match score
  candidates.sort((a, b) => b.matchScore - a.matchScore);

  return {
    myListing: {
      id: listing.id,
      title: listing.title,
      price: listing.price,
      marketValuation: Math.round(myMarketValuation),
    },
    candidates: candidates.slice(0, limit),
    totalFound: candidates.length,
  };
}

// ──────────────────────────────────────────────
// SWAP PROPOSAL
// ──────────────────────────────────────────────

/**
 * Generate a swap proposal message to send to the other party.
 */
export async function generateSwapProposal(
  myListingId: string,
  theirListingId: string,
  userId: string,
): Promise<SwapProposal> {
  const [myListing, theirListing] = await Promise.all([
    db.listing.findUnique({
      where: { id: myListingId },
      select: {
        id: true,
        title: true,
        price: true,
        categoryId: true,
        locationId: true,
        userId: true,
      },
    }),
    db.listing.findUnique({
      where: { id: theirListingId },
      select: {
        id: true,
        title: true,
        price: true,
        categoryId: true,
        locationId: true,
        userId: true,
      },
    }),
  ]);

  if (!myListing || myListing.userId !== userId) {
    throw new Error("Your listing not found");
  }
  if (!theirListing) {
    throw new Error("Target listing not found");
  }

  // Get market valuations
  const [myStats, theirStats] = await Promise.all([
    getMarketStats(myListing.categoryId, myListing.locationId ?? undefined),
    getMarketStats(
      theirListing.categoryId,
      theirListing.locationId ?? undefined,
    ),
  ]);

  const myMarketValue = myStats?.medianPrice ?? myListing.price;
  const theirMarketValue = theirStats?.medianPrice ?? theirListing.price;
  const cashDifference = Math.round(theirMarketValue - myMarketValue);

  // Generate proposal message
  let message: string;
  if (
    Math.abs(cashDifference) <
    Math.max(myMarketValue, theirMarketValue) * 0.05
  ) {
    // Values are close — straight swap
    message =
      `Hi! I noticed your "${theirListing.title}" and I think we could do a great swap. ` +
      `I have a "${myListing.title}" that's valued similarly on the market. ` +
      `Would you be interested in a straight trade?`;
  } else if (cashDifference > 0) {
    // Their item is worth more — I'd pay the difference
    message =
      `Hi! I'm interested in your "${theirListing.title}". ` +
      `I have a "${myListing.title}" I'd like to offer as a swap, ` +
      `plus €${cashDifference} to make it fair based on current market values. ` +
      `Would you be interested?`;
  } else {
    // My item is worth more — they'd pay the difference
    message =
      `Hi! I noticed your "${theirListing.title}" and I think we could swap! ` +
      `I have a "${myListing.title}" which has a slightly higher market value. ` +
      `A swap plus €${Math.abs(cashDifference)} on your side would make it even. ` +
      `Let me know if you're interested!`;
  }

  // Log the agent action
  await db.agentAction.create({
    data: {
      agentType: "SELLING",
      actionType: "OFFER_SENT",
      description: `Swap proposal: "${myListing.title}" ↔ "${theirListing.title}", cash diff €${cashDifference}`,
      metadata: {
        type: "swap_proposal",
        myListingId,
        theirListingId,
        myMarketValue,
        theirMarketValue,
        cashDifference,
      },
    },
  });

  return {
    myListingId,
    theirListingId,
    myMarketValue: Math.round(myMarketValue),
    theirMarketValue: Math.round(theirMarketValue),
    cashDifference,
    message,
  };
}

/**
 * Run swap matching for all active listings of a user.
 * Called by scheduled worker to proactively find swaps.
 */
export async function runSwapMatching(userId: string): Promise<{
  listingsChecked: number;
  swapsFound: number;
}> {
  const listings = await db.listing.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
    take: 20,
  });

  let swapsFound = 0;

  for (const listing of listings) {
    try {
      const result = await findSwapCandidates(listing.id, userId, 5);
      const goodMatches = result.candidates.filter((c) => c.matchScore >= 60);

      if (goodMatches.length > 0) {
        swapsFound += goodMatches.length;

        // Notify user about top swap opportunity
        const best = goodMatches[0];
        await createNotification(userId, best.listing.title, listing.id, best);
      }
    } catch {
      // continue with next listing
    }
  }

  return { listingsChecked: listings.length, swapsFound };
}

async function createNotification(
  userId: string,
  swapTitle: string,
  listingId: string,
  candidate: SwapCandidate,
): Promise<void> {
  try {
    const { createNotification: notify } = await import("./notification");
    await notify({
      userId,
      type: "AGENT_ACTION",
      title: "Swap Opportunity Found!",
      body: `Your listing could be swapped for "${swapTitle}" (${candidate.matchScore}% match)${
        candidate.cashDifference !== 0
          ? `. Cash difference: €${Math.abs(candidate.cashDifference)}`
          : " — straight swap possible!"
      }`,
      metadata: {
        type: "swap_opportunity",
        listingId,
        swapListingId: candidate.listing.id,
        matchScore: candidate.matchScore,
        cashDifference: candidate.cashDifference,
      },
    });
  } catch {
    // non-critical
  }
}
