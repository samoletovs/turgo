import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type TRPCContext, createCallerFactory } from '@/server/trpc';
import { appRouter } from '@/server/trpc/router';
import { mockDb } from '@/__tests__/setup';

// Mock agent-selling service (dynamic import used by handleOffer / getDailySummary)
vi.mock('@/server/services/agent-selling', () => ({
  evaluateOffer: vi.fn().mockResolvedValue({
    action: 'counter',
    counterPrice: 170,
    message: 'How about €170?',
    reasoning: 'Counter at €170',
  }),
  processIncomingOffer: vi.fn().mockResolvedValue({
    offerId: 'offer-1',
    message: 'Your offer has been submitted. The seller will review it and respond.',
    status: 'PENDING',
  }),
  generateDailySummary: vi.fn().mockResolvedValue({
    agentId: 'agent-1',
    listingTitle: 'Widget',
    date: '2026-02-22',
    metrics: { views: 50, inquiries: 2, offers: 1, priceChanges: 0 },
    highlights: ['Answered 2 buyer questions'],
    recommendations: [],
    pricingStatus: {
      currentPrice: 180,
      originalPrice: 200,
      changePercent: -10,
    },
  }),
}));

// ─── Helpers ────────────────────────────────────────────────
const createCaller = createCallerFactory(appRouter);
const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';

function authedCtx(userId = 'user-1'): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext['db'],
    session: {
      user: {
        id: userId,
        name: 'Test',
        email: 't@t.com',
        role: 'USER',
        locale: 'en',
      },
      expires: new Date(Date.now() + 86400_000).toISOString(),
    },
    headers: new Headers(),
  };
}

function anonCtx(): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext['db'],
    session: null,
    headers: new Headers(),
  };
}

// ─── Reset mocks ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// agent.createSelling
// ──────────────────────────────────────────────
describe('agent.createSelling', () => {
  const validInput = {
    listingId: validCuid,
    urgency: 'ONE_WEEK' as const,
    startingPrice: 200,
    minimumPrice: 100,
    autoRespond: true,
    autoNegotiate: false,
    autoBoost: false,
  };

  it('creates a selling agent with valid input', async () => {
    mockDb.sellingAgent.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { plan: { maxSellingAgents: 5 } },
    });
    mockDb.sellingAgent.create.mockResolvedValue({
      id: 'sa-1',
      ...validInput,
      currentPrice: 200,
      status: 'ACTIVE',
    });
    mockDb.listing.update.mockResolvedValue({});
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.agent.createSelling(validInput);

    expect(result.id).toBe('sa-1');
    expect(result.status).toBe('ACTIVE');
    expect(mockDb.sellingAgent.create).toHaveBeenCalledOnce();
    expect(mockDb.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validCuid },
        data: { managedByAgent: true },
      }),
    );
    expect(mockDb.agentAction.create).toHaveBeenCalledOnce();
  });

  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.createSelling(validInput)).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('throws when plan limit exceeded', async () => {
    mockDb.sellingAgent.count.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { plan: { maxSellingAgents: 1 } },
    });

    const caller = createCaller(authedCtx());
    await expect(caller.agent.createSelling(validInput)).rejects.toThrow(/at most 1/);
  });

  it('defaults to 1 agent when no subscription', async () => {
    mockDb.sellingAgent.count.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: null,
    });

    const caller = createCaller(authedCtx());
    await expect(caller.agent.createSelling(validInput)).rejects.toThrow(/at most 1/);
  });

  it('rejects invalid urgency value', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.agent.createSelling({
        ...validInput,
        urgency: 'INVALID' as never,
      }),
    ).rejects.toThrow();
  });

  it('rejects negative startingPrice', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.agent.createSelling({ ...validInput, startingPrice: -10 }),
    ).rejects.toThrow();
  });

  it('rejects negative minimumPrice', async () => {
    const caller = createCaller(authedCtx());
    await expect(caller.agent.createSelling({ ...validInput, minimumPrice: -5 })).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────
// agent.createBuying
// ──────────────────────────────────────────────
describe('agent.createBuying', () => {
  const validInput = {
    searchCriteria: { categoryId: 'cat-1', keywords: 'phone' },
    maxBudget: 500,
    targetPrice: 300,
    autoNegotiate: false,
    notifyPush: true,
    notifyEmail: true,
  };

  it('creates a buying agent with valid input', async () => {
    mockDb.buyingAgent.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { plan: { maxBuyingAgents: 3 } },
    });
    mockDb.buyingAgent.create.mockResolvedValue({
      id: 'ba-1',
      ...validInput,
      status: 'ACTIVE',
    });
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.agent.createBuying(validInput);

    expect(result.id).toBe('ba-1');
    expect(mockDb.buyingAgent.create).toHaveBeenCalledOnce();
    expect(mockDb.agentAction.create).toHaveBeenCalledOnce();
  });

  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.createBuying(validInput)).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('throws when plan limit exceeded', async () => {
    mockDb.buyingAgent.count.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { plan: { maxBuyingAgents: 1 } },
    });

    const caller = createCaller(authedCtx());
    await expect(caller.agent.createBuying(validInput)).rejects.toThrow(/at most 1/);
  });

  it('rejects negative maxBudget', async () => {
    const caller = createCaller(authedCtx());
    await expect(caller.agent.createBuying({ ...validInput, maxBudget: -100 })).rejects.toThrow();
  });

  it('accepts empty searchCriteria', async () => {
    mockDb.buyingAgent.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { plan: { maxBuyingAgents: 3 } },
    });
    mockDb.buyingAgent.create.mockResolvedValue({
      id: 'ba-2',
      status: 'ACTIVE',
    });
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.agent.createBuying({
      ...validInput,
      searchCriteria: {},
    });
    expect(result.id).toBe('ba-2');
  });

  it('defaults to 3 agents when no subscription', async () => {
    mockDb.buyingAgent.count.mockResolvedValue(3);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: null,
    });

    const caller = createCaller(authedCtx());
    await expect(caller.agent.createBuying(validInput)).rejects.toThrow(/at most 3/);
  });
});

// ──────────────────────────────────────────────
// agent.updateStatus
// ──────────────────────────────────────────────
describe('agent.updateStatus', () => {
  const validInput = { agentId: validCuid, status: 'PAUSED' as const };

  it('updates a selling agent status', async () => {
    mockDb.sellingAgent.findFirst.mockResolvedValue({
      id: validCuid,
      userId: 'user-1',
      status: 'ACTIVE',
    });
    mockDb.sellingAgent.update.mockResolvedValue({
      id: validCuid,
      status: 'PAUSED',
    });
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.agent.updateStatus(validInput);

    expect(result.status).toBe('PAUSED');
    expect(mockDb.sellingAgent.update).toHaveBeenCalledOnce();
    expect(mockDb.agentAction.create).toHaveBeenCalledOnce();
  });

  it('falls back to buying agent when selling agent not found', async () => {
    mockDb.sellingAgent.findFirst.mockResolvedValue(null);
    mockDb.buyingAgent.findFirst.mockResolvedValue({
      id: validCuid,
      userId: 'user-1',
      status: 'ACTIVE',
    });
    mockDb.buyingAgent.update.mockResolvedValue({
      id: validCuid,
      status: 'PAUSED',
    });
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.agent.updateStatus(validInput);

    expect(result.status).toBe('PAUSED');
    expect(mockDb.buyingAgent.update).toHaveBeenCalledOnce();
    expect(mockDb.agentAction.create).toHaveBeenCalledOnce();
  });

  it('sets completedAt when status is COMPLETED', async () => {
    mockDb.sellingAgent.findFirst.mockResolvedValue({
      id: validCuid,
      userId: 'user-1',
      status: 'ACTIVE',
    });
    mockDb.sellingAgent.update.mockResolvedValue({
      id: validCuid,
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    mockDb.agentAction.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    await caller.agent.updateStatus({
      agentId: validCuid,
      status: 'COMPLETED',
    });

    expect(mockDb.sellingAgent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      }),
    );
  });

  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.updateStatus(validInput)).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('rejects invalid status enum', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.agent.updateStatus({
        agentId: validCuid,
        status: 'INVALID' as never,
      }),
    ).rejects.toThrow();
  });

  it('rejects non-cuid agentId', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.agent.updateStatus({ agentId: 'not-a-cuid', status: 'PAUSED' }),
    ).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────
// agent.submitOffer (strategy-based offer submission)
// ──────────────────────────────────────────────
describe('agent.submitOffer', () => {
  const validInput = {
    sellingAgentId: validCuid,
    listingId: validCuid,
    offerPrice: 150,
    message: "I'm interested!",
  };

  it('submits an offer and returns a BuyerOfferAck', async () => {
    mockDb.sellingAgent.findUnique.mockResolvedValue({
      id: 'sa-1',
      sellingStrategyId: 'SEALED_BID',
      strategyConfig: null,
      minimumPrice: 100,
      currentPrice: null,
      urgency: 'ONE_WEEK',
      totalInquiries: 0,
      listing: {
        id: validCuid,
        title: 'Test Listing',
        price: 200,
        currency: 'EUR',
        viewCount: 10,
        createdAt: new Date(),
        expiresAt: null,
      },
    });
    mockDb.offer.findFirst.mockResolvedValue(null);
    mockDb.offer.create.mockResolvedValue({
      id: 'offer-1',
      price: 150,
      status: 'PENDING',
      createdAt: new Date(),
    });

    const caller = createCaller(authedCtx());
    const result = await caller.agent.submitOffer(validInput);

    expect(result).toHaveProperty('offerId');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('status');
  });

  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.submitOffer(validInput)).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('rejects non-positive amount', async () => {
    const caller = createCaller(authedCtx());
    await expect(caller.agent.submitOffer({ ...validInput, offerPrice: -10 })).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────
// agent.acceptOffer / agent.declineOffer
// ──────────────────────────────────────────────
describe('agent.acceptOffer', () => {
  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.acceptOffer({ offerId: validCuid })).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe('agent.declineOffer', () => {
  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.declineOffer({ offerId: validCuid })).rejects.toThrow(/UNAUTHORIZED/);
  });
});

// ──────────────────────────────────────────────
// agent.getDailySummary
// ──────────────────────────────────────────────
describe('agent.getDailySummary', () => {
  it('returns a daily summary for owned agent', async () => {
    mockDb.sellingAgent.findFirst.mockResolvedValue({
      id: validCuid,
      userId: 'user-1',
    });

    const caller = createCaller(authedCtx());
    const result = await caller.agent.getDailySummary({ agentId: validCuid });

    expect(result).toHaveProperty('agentId');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('highlights');
  });

  it('throws when agent not found', async () => {
    mockDb.sellingAgent.findFirst.mockResolvedValue(null);

    const caller = createCaller(authedCtx());
    await expect(caller.agent.getDailySummary({ agentId: validCuid })).rejects.toThrow(
      'Agent not found',
    );
  });

  it('throws UNAUTHORIZED without session', async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.agent.getDailySummary({ agentId: validCuid })).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });
});
