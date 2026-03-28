import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

import { calculateDealScore, monitorForMatches } from '@/server/services/agent-buying';

// ─── Reset mocks ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// calculateDealScore (7-factor scoring)
// ──────────────────────────────────────────────
describe('calculateDealScore', () => {
  const baseParams = {
    listingId: 'listing-1',
    categoryId: 'cat-1',
    targetPrice: 100,
    maxBudget: 150,
  };

  const mkListing = (overrides: Record<string, unknown> = {}) => ({
    id: 'listing-1',
    price: 100,
    condition: 'USED',
    description:
      'A decent used item with lots of detail that exceeds 100 characters for testing purposes and more text here',
    negotiable: true,
    managedByAgent: false,
    locationId: 'loc-1',
    categoryId: 'cat-1',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old
    images: [{ id: 'img-1', url: 'http://example.com/img.jpg' }],
    user: { _count: { reviewsReceived: 3 } },
    ...overrides,
  });

  it('returns zero score when listing not found', async () => {
    mockDb.listing.findUnique.mockResolvedValue(null);

    const result = await calculateDealScore(baseParams);

    expect(result.total).toBe(0);
    expect(result.priceVsMarket).toBe(0);
    expect(result.timeOnMarket).toBe(0);
  });

  it('returns all 7 score components', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing());
    mockDb.marketSnapshot.findFirst.mockResolvedValue({
      medianPrice: 120,
      date: new Date(),
    });

    const result = await calculateDealScore(baseParams);

    expect(result).toHaveProperty('priceVsMarket');
    expect(result).toHaveProperty('timeOnMarket');
    expect(result).toHaveProperty('sellerUrgency');
    expect(result).toHaveProperty('listingQuality');
    expect(result).toHaveProperty('sellerReputation');
    expect(result).toHaveProperty('locationConvenience');
    expect(result).toHaveProperty('conditionVsPrice');
    expect(result).toHaveProperty('total');
  });

  it('gives higher priceVsMarket when listing price is far below median', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ price: 50 }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 200 });

    const result = await calculateDealScore(baseParams);

    expect(result.priceVsMarket).toBeGreaterThan(15); // Significantly below median
  });

  it('gives zero priceVsMarket when listing price is above median', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ price: 300 }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await calculateDealScore(baseParams);

    expect(result.priceVsMarket).toBe(0);
  });

  it('gives higher timeOnMarket score for older listings', async () => {
    const oldListing = mkListing({
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });
    const newListing = mkListing({
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    mockDb.listing.findUnique.mockResolvedValue(oldListing);
    const oldResult = await calculateDealScore(baseParams);

    mockDb.listing.findUnique.mockResolvedValue(newListing);
    const newResult = await calculateDealScore(baseParams);

    expect(oldResult.timeOnMarket).toBeGreaterThan(newResult.timeOnMarket);
  });

  it('gives higher urgency score when seller uses agent', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ managedByAgent: true }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const agentResult = await calculateDealScore(baseParams);

    mockDb.listing.findUnique.mockResolvedValue(
      mkListing({ managedByAgent: false, negotiable: false }),
    );
    const noAgentResult = await calculateDealScore(baseParams);

    expect(agentResult.sellerUrgency).toBeGreaterThan(noAgentResult.sellerUrgency);
  });

  it('scores listing quality based on images and description length', async () => {
    // With images and long description → 10
    mockDb.listing.findUnique.mockResolvedValue(mkListing());
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const goodQuality = await calculateDealScore(baseParams);
    expect(goodQuality.listingQuality).toBe(10);

    // No images and short description → 0
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ images: [], description: 'Short' }));
    const badQuality = await calculateDealScore(baseParams);
    expect(badQuality.listingQuality).toBe(0);
  });

  it('scores seller reputation from review count', async () => {
    mockDb.listing.findUnique.mockResolvedValue(
      mkListing({ user: { _count: { reviewsReceived: 10 } } }),
    );
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await calculateDealScore(baseParams);
    expect(result.sellerReputation).toBe(10); // capped at 10
  });

  it('gives full location score when locations match', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ locationId: 'loc-1' }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await calculateDealScore({
      ...baseParams,
      locationId: 'loc-1',
    });
    expect(result.locationConvenience).toBe(10);
  });

  it('gives partial location score when locations differ', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ locationId: 'loc-2' }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await calculateDealScore({
      ...baseParams,
      locationId: 'loc-1',
    });
    expect(result.locationConvenience).toBe(5);
  });

  it('gives higher conditionVsPrice for NEW items priced below median', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing({ condition: 'NEW', price: 80 }));
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await calculateDealScore(baseParams);
    expect(result.conditionVsPrice).toBe(10);
  });

  it('caps total score at 100', async () => {
    // Extremely favorable conditions
    mockDb.listing.findUnique.mockResolvedValue(
      mkListing({
        price: 10,
        condition: 'NEW',
        managedByAgent: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        user: { _count: { reviewsReceived: 50 } },
      }),
    );
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 500 });

    const result = await calculateDealScore({
      ...baseParams,
      locationId: 'loc-1',
    });
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('handles missing market snapshot gracefully', async () => {
    mockDb.listing.findUnique.mockResolvedValue(mkListing());
    mockDb.marketSnapshot.findFirst.mockResolvedValue(null);

    const result = await calculateDealScore(baseParams);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────
// monitorForMatches (checkMatches)
// ──────────────────────────────────────────────
describe('monitorForMatches', () => {
  it('returns 0 when agent not found', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue(null);

    const result = await monitorForMatches('nonexistent');
    expect(result).toBe(0);
  });

  it('returns 0 when agent is not ACTIVE', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue({
      id: 'ba-1',
      status: 'PAUSED',
      searchCriteria: {},
      maxBudget: 500,
      matches: [],
    });

    const result = await monitorForMatches('ba-1');
    expect(result).toBe(0);
  });

  it('finds matches above threshold and creates records', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue({
      id: 'ba-1',
      status: 'ACTIVE',
      searchCriteria: { categoryId: 'cat-1' },
      maxBudget: 500,
      targetPrice: 300,
      matches: [],
    });

    const fakeListing = {
      id: 'listing-new',
      title: 'Great Deal',
      price: 200,
      categoryId: 'cat-1',
      condition: 'USED',
      description:
        'A very detailed description exceeding one hundred characters for the purpose of testing the listing quality score properly',
      negotiable: true,
      managedByAgent: false,
      locationId: 'loc-1',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      images: [{ id: 'img-1' }],
      user: { _count: { reviewsReceived: 2 } },
    };

    mockDb.listing.findMany.mockResolvedValue([fakeListing]);
    // Mock the inner calculateDealScore calls
    mockDb.listing.findUnique.mockResolvedValue(fakeListing);
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 300 });
    mockDb.agentMatch.create.mockResolvedValue({});
    mockDb.agentAction.create.mockResolvedValue({});
    mockDb.buyingAgent.update.mockResolvedValue({});

    const result = await monitorForMatches('ba-1');

    expect(result).toBeGreaterThanOrEqual(1);
    expect(mockDb.agentMatch.create).toHaveBeenCalled();
    expect(mockDb.agentAction.create).toHaveBeenCalled();
  });

  it('does not create matches below score threshold (30)', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue({
      id: 'ba-2',
      status: 'ACTIVE',
      searchCriteria: {},
      maxBudget: 500,
      targetPrice: 100,
      matches: [],
    });

    const poorListing = {
      id: 'listing-poor',
      title: 'Overpriced',
      price: 480,
      categoryId: 'cat-1',
      condition: 'USED',
      description: 'Short',
      negotiable: false,
      managedByAgent: false,
      locationId: 'loc-x',
      createdAt: new Date(), // brand new
      images: [],
      user: { _count: { reviewsReceived: 0 } },
    };

    mockDb.listing.findMany.mockResolvedValue([poorListing]);
    mockDb.listing.findUnique.mockResolvedValue(poorListing);
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 100 });

    const result = await monitorForMatches('ba-2');

    expect(result).toBe(0);
    expect(mockDb.agentMatch.create).not.toHaveBeenCalled();
  });

  it('excludes already-matched listings', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue({
      id: 'ba-3',
      status: 'ACTIVE',
      searchCriteria: {},
      maxBudget: 500,
      targetPrice: 300,
      matches: [{ listingId: 'listing-already' }],
    });

    mockDb.listing.findMany.mockResolvedValue([]); // None after exclusion

    const result = await monitorForMatches('ba-3');

    expect(result).toBe(0);
    // Verify the notIn filter was passed
    expect(mockDb.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['listing-already'] },
        }),
      }),
    );
  });

  it('updates agent match count after finding matches', async () => {
    mockDb.buyingAgent.findUnique.mockResolvedValue({
      id: 'ba-4',
      status: 'ACTIVE',
      searchCriteria: { categoryId: 'cat-1' },
      maxBudget: 500,
      targetPrice: 200,
      matches: [],
    });

    const goodListing = {
      id: 'listing-good',
      title: 'Good Deal',
      price: 100,
      categoryId: 'cat-1',
      condition: 'USED',
      description:
        'A very detailed description that is well over one hundred characters to ensure the listing quality score is fully calculated',
      negotiable: true,
      managedByAgent: true,
      locationId: 'loc-1',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      images: [{ id: 'img-1' }],
      user: { _count: { reviewsReceived: 5 } },
    };

    mockDb.listing.findMany.mockResolvedValue([goodListing]);
    mockDb.listing.findUnique.mockResolvedValue(goodListing);
    mockDb.marketSnapshot.findFirst.mockResolvedValue({ medianPrice: 300 });
    mockDb.agentMatch.create.mockResolvedValue({});
    mockDb.agentAction.create.mockResolvedValue({});
    mockDb.buyingAgent.update.mockResolvedValue({});

    await monitorForMatches('ba-4');

    expect(mockDb.buyingAgent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ba-4' },
        data: { matchCount: { increment: expect.any(Number) } },
      }),
    );
  });
});
