import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "@/__tests__/setup";

// Mock AI services before importing the module under test
vi.mock("@/server/services/ai", () => ({
  aiComplete: vi.fn().mockResolvedValue({
    content: "I appreciate the offer! How about we meet in the middle?",
    model: "test-model",
    provider: "github",
  }),
  createMessages: vi.fn((_sys: string, _usr: string) => [
    { role: "system", content: _sys },
    { role: "user", content: _usr },
  ]),
}));

// marketSnapshot is now built into mockDb from shared setup

import {
  calculateOptimalPrice,
  processIncomingOffer,
  generateDailySummary,
  shouldAdjustPrice,
  shouldBoost,
} from "@/server/services/agent-selling";

// ─── Reset mocks ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// calculateOptimalPrice (10-factor pricing)
// ──────────────────────────────────────────────
describe("calculateOptimalPrice", () => {
  const baseParams = {
    categoryId: "cat-1",
    locationId: "loc-1",
    condition: "USED",
    userBasePrice: 200,
    urgency: "ONE_WEEK",
  };

  it("returns suggested price, factors, curve, and reasoning", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 180,
      listingCount: 15,
      demandScore: 1.5,
      avgPrice: 185,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      {
        medianPrice: 180,
        listingCount: 15,
        demandScore: 1.5,
        date: new Date(),
      },
    ]);

    const result = await calculateOptimalPrice(baseParams);

    expect(result).toHaveProperty("suggestedPrice");
    expect(result).toHaveProperty("factors");
    expect(result).toHaveProperty("curve");
    expect(result).toHaveProperty("reasoning");
    expect(result.suggestedPrice).toBeGreaterThan(0);
    expect(typeof result.reasoning).toBe("string");
  });

  it("returns all 10 pricing factors between 0 and 1", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 200,
      listingCount: 10,
      demandScore: 1,
      avgPrice: 200,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 10, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice(baseParams);
    const factorKeys = [
      "urgency",
      "marketSupply",
      "marketDemand",
      "seasonality",
      "condition",
      "locationDemand",
      "postingTiming",
      "competitionAge",
      "priceElasticity",
      "sellerReputation",
    ];

    for (const key of factorKeys) {
      const value = result.factors[key as keyof typeof result.factors];
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(result.factors)).toHaveLength(10);
  });

  it("generates pricing curve with correct start and end", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 300,
      listingCount: 5,
      demandScore: 1,
      avgPrice: 300,
      minPrice: 200,
      maxPrice: 400,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 300, listingCount: 5, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice(baseParams);

    expect(result.curve.length).toBeGreaterThanOrEqual(2);
    // Curve should start at highest price
    expect(result.curve[0].day).toBe(0);
    expect(result.curve[0].price).toBeGreaterThanOrEqual(
      result.curve[result.curve.length - 1].price,
    );
    // Each point has a reason
    for (const pt of result.curve) {
      expect(pt.reason).toBeTruthy();
    }
  });

  it("handles no market data (uses userBasePrice as fallback)", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.marketSnapshot.findMany.mockResolvedValue([]);

    const result = await calculateOptimalPrice(baseParams);

    expect(result.suggestedPrice).toBeGreaterThan(0);
    expect(result.reasoning).toContain("0 similar listings");
  });

  it("sets condition factor to 1 for NEW items", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 200,
      listingCount: 10,
      demandScore: 1,
      avgPrice: 200,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 10, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice({
      ...baseParams,
      condition: "NEW",
    });
    expect(result.factors.condition).toBe(1);
  });

  it("sets condition factor to 0.7 for REFURBISHED items", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 200,
      listingCount: 10,
      demandScore: 1,
      avgPrice: 200,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 10, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice({
      ...baseParams,
      condition: "REFURBISHED",
    });
    expect(result.factors.condition).toBe(0.7);
  });

  it("adjusts supply factor for high listing count", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 200,
      listingCount: 60,
      demandScore: 1,
      avgPrice: 200,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 60, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice(baseParams);
    // >50 listings → supply factor = 0.3
    expect(result.factors.marketSupply).toBe(0.3);
  });

  it("handles high urgency (ONE_DAY)", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 200,
      listingCount: 10,
      demandScore: 1,
      avgPrice: 200,
      minPrice: 100,
      maxPrice: 300,
      avgDaysToSell: null,
      priceSpread: 200,
      subcategorySlug: null,
      date: new Date(),
    });
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 10, demandScore: 1, date: new Date() },
    ]);

    const highUrgency = await calculateOptimalPrice({
      ...baseParams,
      urgency: "ONE_DAY",
    });
    const lowUrgency = await calculateOptimalPrice({
      ...baseParams,
      urgency: "NO_RUSH",
    });

    // Higher urgency → higher urgency factor → different suggested price
    expect(highUrgency.factors.urgency).toBeGreaterThan(
      lowUrgency.factors.urgency,
    );
  });

  it("never returns suggestedPrice less than 1", async () => {
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 0, listingCount: 0, demandScore: 0, date: new Date() },
    ]);

    const result = await calculateOptimalPrice({
      ...baseParams,
      userBasePrice: 0,
    });
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────
// processIncomingOffer (strategy-based offer processing)
// ──────────────────────────────────────────────
describe("processIncomingOffer", () => {
  const baseOffer = {
    sellingAgentId: "sa-1",
    listingId: "listing-1",
    buyerId: "buyer-1",
    offerPrice: 150,
    message: "I'm interested!",
  };

  it("returns a BuyerOfferAck with generic message (no price leak)", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "sa-1",
      sellingStrategyId: "SEALED_BID",
      strategyConfig: null,
      minimumPrice: 100,
      currentPrice: null,
      urgency: "ONE_WEEK",
      totalInquiries: 0,
      listing: {
        id: "listing-1",
        title: "Test Listing",
        price: 200,
        currency: "EUR",
        viewCount: 10,
        createdAt: new Date(),
        expiresAt: null,
      },
    });
    mockDb.offer.findFirst.mockResolvedValue(null);
    mockDb.offer.create.mockResolvedValue({
      id: "offer-1",
      price: 150,
      status: "PENDING",
      createdAt: new Date(),
    });

    const result = await processIncomingOffer(baseOffer);

    expect(result).toHaveProperty("offerId");
    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("status");
    // Should NOT reveal price info in the buyer ack
    expect(result.message).not.toContain("150");
    expect(result.message).not.toContain("minimum");
  });

  it("supersedes previous PENDING offers from same buyer", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "sa-1",
      sellingStrategyId: "SEALED_BID",
      strategyConfig: null,
      minimumPrice: 100,
      currentPrice: null,
      urgency: "ONE_WEEK",
      totalInquiries: 0,
      listing: {
        id: "listing-1",
        title: "Test Listing",
        price: 200,
        currency: "EUR",
        viewCount: 10,
        createdAt: new Date(),
        expiresAt: null,
      },
    });
    mockDb.offer.findFirst.mockResolvedValue({
      id: "offer-old",
      price: 150,
      status: "PENDING",
    });
    mockDb.offer.create.mockResolvedValue({
      id: "offer-2",
      price: 160,
      status: "PENDING",
      createdAt: new Date(),
    });
    mockDb.offer.update.mockResolvedValue({
      id: "offer-old",
      status: "SUPERSEDED",
    });

    await processIncomingOffer({ ...baseOffer, offerPrice: 160 });

    expect(mockDb.offer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          listingId: "listing-1",
          buyerId: "buyer-1",
          status: "PENDING",
        }),
      }),
    );
    expect(mockDb.offer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-old" },
        data: expect.objectContaining({
          status: "SUPERSEDED",
        }),
      }),
    );
  });
});

// ──────────────────────────────────────────────
// shouldAdjustPrice
// ──────────────────────────────────────────────
describe("shouldAdjustPrice", () => {
  it("does not adjust early with decent engagement", () => {
    const result = shouldAdjustPrice({
      currentPrice: 200,
      minimumPrice: 100,
      totalViews: 50,
      totalInquiries: 5,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day
      urgency: "ONE_WEEK",
    });
    expect(result.shouldAdjust).toBe(false);
  });

  it("adjusts for low engagement after 30% of deadline", () => {
    const result = shouldAdjustPrice({
      currentPrice: 200,
      minimumPrice: 100,
      totalViews: 100,
      totalInquiries: 0,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days
      urgency: "ONE_WEEK", // 7 days total
    });
    expect(result.shouldAdjust).toBe(true);
    expect(result.newPrice).toBeDefined();
    expect(result.newPrice!).toBeLessThan(200);
    expect(result.newPrice!).toBeGreaterThanOrEqual(100);
  });

  it("adjusts with deadline pressure after 70%", () => {
    const result = shouldAdjustPrice({
      currentPrice: 200,
      minimumPrice: 100,
      totalViews: 50,
      totalInquiries: 3,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days
      urgency: "ONE_WEEK", // 7 days total
    });
    expect(result.shouldAdjust).toBe(true);
    expect(result.reason).toContain("deadline");
  });

  it("never adjusts below minimum price", () => {
    const result = shouldAdjustPrice({
      currentPrice: 105,
      minimumPrice: 100,
      totalViews: 200,
      totalInquiries: 0,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      urgency: "ONE_WEEK",
    });
    if (result.shouldAdjust) {
      expect(result.newPrice!).toBeGreaterThanOrEqual(100);
    }
  });

  it("does not adjust when already at minimum", () => {
    const result = shouldAdjustPrice({
      currentPrice: 100,
      minimumPrice: 100,
      totalViews: 200,
      totalInquiries: 0,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      urgency: "ONE_WEEK",
    });
    expect(result.shouldAdjust).toBe(false);
  });

  it("handles zero views gracefully", () => {
    const result = shouldAdjustPrice({
      currentPrice: 200,
      minimumPrice: 100,
      totalViews: 0,
      totalInquiries: 0,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour
      urgency: "ONE_WEEK",
    });
    expect(result.shouldAdjust).toBe(false);
  });
});

// ──────────────────────────────────────────────
// shouldBoost
// ──────────────────────────────────────────────
describe("shouldBoost", () => {
  it("recommends no boost if already boosted", () => {
    const result = shouldBoost({
      totalViews: 5,
      totalInquiries: 0,
      daysActive: 3,
      urgency: "ONE_WEEK",
      currentlyBoosted: true,
      previousBoosts: 0,
    });
    expect(result.shouldBoost).toBe(false);
    expect(result.reason).toContain("Already boosted");
  });

  it("recommends no boost if max boosts reached", () => {
    const result = shouldBoost({
      totalViews: 5,
      totalInquiries: 0,
      daysActive: 3,
      urgency: "ONE_WEEK",
      currentlyBoosted: false,
      previousBoosts: 3,
    });
    expect(result.shouldBoost).toBe(false);
    expect(result.reason).toContain("Maximum boost limit");
  });

  it("recommends boost for low daily views", () => {
    const result = shouldBoost({
      totalViews: 3,
      totalInquiries: 0,
      daysActive: 2,
      urgency: "ONE_WEEK",
      currentlyBoosted: false,
      previousBoosts: 0,
    });
    expect(result.shouldBoost).toBe(true);
    expect(result.estimatedReachIncrease).toBeGreaterThan(0);
    expect(result.suggestedDuration).toBeGreaterThan(0);
  });

  it("recommends boost for views without inquiries", () => {
    const result = shouldBoost({
      totalViews: 50,
      totalInquiries: 0,
      daysActive: 3,
      urgency: "ONE_WEEK",
      currentlyBoosted: false,
      previousBoosts: 0,
    });
    expect(result.shouldBoost).toBe(true);
  });

  it("recommends boost under urgency pressure", () => {
    const result = shouldBoost({
      totalViews: 60,
      totalInquiries: 1,
      daysActive: 6,
      urgency: "ONE_WEEK", // 7 days → 85% elapsed
      currentlyBoosted: false,
      previousBoosts: 1,
    });
    expect(result.shouldBoost).toBe(true);
    expect(result.reason).toContain("elapsed");
  });

  it("recommends no boost when engagement is adequate", () => {
    const result = shouldBoost({
      totalViews: 100,
      totalInquiries: 10,
      daysActive: 2,
      urgency: "TWO_WEEKS",
      currentlyBoosted: false,
      previousBoosts: 0,
    });
    expect(result.shouldBoost).toBe(false);
  });
});

// ──────────────────────────────────────────────
// generateDailySummary
// ──────────────────────────────────────────────
describe("generateDailySummary", () => {
  it("returns null when agent not found", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue(null);
    const result = await generateDailySummary("nonexistent");
    expect(result).toBeNull();
  });

  it("returns a summary with correct shape", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "agent-1",
      startingPrice: 200,
      listing: {
        title: "Cool Widget",
        price: 180,
        currency: "EUR",
        viewCount: 42,
      },
      actions: [
        { actionType: "AUTO_RESPOND", createdAt: new Date() },
        { actionType: "PRICE_ADJUST", createdAt: new Date() },
      ],
    });

    const result = await generateDailySummary("agent-1");

    expect(result).not.toBeNull();
    expect(result!.agentId).toBe("agent-1");
    expect(result!.listingTitle).toBe("Cool Widget");
    expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result!.metrics.views).toBe(42);
    expect(result!.highlights.length).toBeGreaterThan(0);
    expect(result!.pricingStatus.currentPrice).toBe(180);
    expect(result!.pricingStatus.originalPrice).toBe(200);
    expect(result!.pricingStatus.changePercent).toBe(-10);
  });

  it("reports quiet day when no actions", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "agent-2",
      startingPrice: 100,
      listing: {
        title: "Silent Item",
        price: 100,
        currency: "EUR",
        viewCount: 0,
      },
      actions: [],
    });

    const result = await generateDailySummary("agent-2");

    expect(result!.highlights).toContain("Quiet day — no significant activity");
    expect(result!.recommendations.length).toBeGreaterThan(0);
  });

  it("counts negotiation actions separately", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "agent-3",
      startingPrice: 300,
      listing: {
        title: "Negotiated Item",
        price: 280,
        currency: "EUR",
        viewCount: 55,
      },
      actions: [
        { actionType: "AUTO_NEGOTIATE", createdAt: new Date() },
        { actionType: "AUTO_NEGOTIATE", createdAt: new Date() },
        { actionType: "AUTO_RESPOND", createdAt: new Date() },
      ],
    });

    const result = await generateDailySummary("agent-3");

    expect(result!.metrics.offers).toBe(2); // 2 negotiations
    expect(result!.metrics.inquiries).toBe(1); // 1 auto-respond
  });

  it("handles missing viewCount gracefully", async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: "agent-4",
      startingPrice: 100,
      listing: {
        title: "No Views",
        price: 100,
        currency: "EUR",
        viewCount: null,
      },
      actions: [],
    });

    const result = await generateDailySummary("agent-4");
    expect(result!.metrics.views).toBe(0);
  });
});
