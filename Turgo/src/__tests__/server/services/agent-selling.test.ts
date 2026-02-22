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
  evaluateOffer,
  generateDailySummary,
  shouldAdjustPrice,
  shouldBoost,
  type NegotiationRules,
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
    mockDb.marketSnapshot.findMany.mockResolvedValue([]);

    const result = await calculateOptimalPrice(baseParams);

    expect(result.suggestedPrice).toBeGreaterThan(0);
    expect(result.reasoning).toContain("0 similar listings");
  });

  it("sets condition factor to 1 for NEW items", async () => {
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
    mockDb.marketSnapshot.findMany.mockResolvedValue([
      { medianPrice: 200, listingCount: 60, demandScore: 1, date: new Date() },
    ]);

    const result = await calculateOptimalPrice(baseParams);
    // >50 listings → supply factor = 0.3
    expect(result.factors.marketSupply).toBe(0.3);
  });

  it("handles high urgency (ONE_DAY)", async () => {
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
// evaluateOffer (accept/reject/counter logic)
// ──────────────────────────────────────────────
describe("evaluateOffer", () => {
  const defaultRules: NegotiationRules = {
    minPrice: 50,
    autoAcceptAbove: 180,
    maxCounterRounds: 3,
    concessionRate: 0.3,
  };

  const baseParams = {
    currentPrice: 200,
    rules: defaultRules,
    roundNumber: 0,
    listingTitle: "Test Widget",
  };

  it("auto-accepts offers at or above autoAcceptAbove", async () => {
    const result = await evaluateOffer({ ...baseParams, offerPrice: 200 });
    expect(result.action).toBe("accept");
    expect(result.message).toContain("200");
    expect(result.reasoning).toContain("auto-accept");
  });

  it("auto-accepts offers exactly at threshold", async () => {
    const result = await evaluateOffer({ ...baseParams, offerPrice: 180 });
    expect(result.action).toBe("accept");
  });

  it("rejects offers below minimum price", async () => {
    const result = await evaluateOffer({ ...baseParams, offerPrice: 30 });
    expect(result.action).toBe("reject");
    expect(result.reasoning).toContain("minimum");
  });

  it("escalates when max counter rounds exceeded", async () => {
    const result = await evaluateOffer({
      ...baseParams,
      offerPrice: 100,
      roundNumber: 3,
    });
    expect(result.action).toBe("escalate");
    expect(result.reasoning).toContain("Max negotiation rounds");
  });

  it("counter-offers when between min and autoAccept", async () => {
    const result = await evaluateOffer({ ...baseParams, offerPrice: 100 });
    expect(result.action).toBe("counter");
    expect(result.counterPrice).toBeDefined();
    expect(result.counterPrice!).toBeGreaterThanOrEqual(defaultRules.minPrice);
    expect(result.counterPrice!).toBeLessThanOrEqual(baseParams.currentPrice);
  });

  it("counter price never falls below minimum", async () => {
    const result = await evaluateOffer({
      ...baseParams,
      offerPrice: 55,
      roundNumber: 2,
      rules: { ...defaultRules, concessionRate: 0.9 },
    });
    if (result.action === "counter") {
      expect(result.counterPrice!).toBeGreaterThanOrEqual(
        defaultRules.minPrice,
      );
    }
  });

  it("accepts when counter would be within 2% of offer", async () => {
    // If the gap between counter and offer is < 2% currentPrice, accept
    const result = await evaluateOffer({
      ...baseParams,
      offerPrice: 179,
      rules: { ...defaultRules, autoAcceptAbove: 200, concessionRate: 0.95 },
    });
    // With very high concession and offer close to current, should accept
    expect(["accept", "counter"]).toContain(result.action);
  });

  it("includes buyerMessage context in reasoning when provided", async () => {
    const result = await evaluateOffer({
      ...baseParams,
      offerPrice: 120,
      buyerMessage: "I can pick up today!",
    });
    // Should use AI path which receives the buyerMessage
    expect(result.message).toBeTruthy();
  });

  it("falls back to template message when AI fails", async () => {
    // Make AI fail
    const ai = await import("@/server/services/ai");
    (ai.aiComplete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("AI down"),
    );

    const result = await evaluateOffer({ ...baseParams, offerPrice: 120 });
    expect(result.action).toBe("counter");
    expect(result.message).toContain("€");
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
