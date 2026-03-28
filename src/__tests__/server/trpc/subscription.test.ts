import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

// Mock Stripe service
vi.mock('@/server/services/stripe', () => ({
  createCheckoutSession: vi.fn(),
  createBoostPayment: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  isStripeConfigured: vi.fn(),
}));

import {
  createCheckoutSession,
  createBoostPayment,
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
  isStripeConfigured,
} from '@/server/services/stripe';
import { createCallerFactory } from '@/server/trpc';
import { subscriptionRouter } from '@/server/trpc/routers/subscription';

const mockStripeConfigured = vi.mocked(isStripeConfigured);
const mockCreateCheckout = vi.mocked(createCheckoutSession);
const mockCreateBoost = vi.mocked(createBoostPayment);
const mockCreatePortal = vi.mocked(createPortalSession);
const mockCancelSub = vi.mocked(cancelSubscription);
const mockResumeSub = vi.mocked(resumeSubscription);

const createCaller = createCallerFactory(subscriptionRouter);

function publicCaller() {
  return createCaller({
    db: mockDb as never,
    session: null,
    headers: new Headers(),
  });
}

function authedCaller(userId = 'user-1') {
  return createCaller({
    db: mockDb as never,
    session: {
      user: { id: userId, email: 'test@test.com', role: 'USER', locale: 'en' },
      expires: '',
    },
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// getPlans
// ──────────────────────────────────────────────────────────────
describe('getPlans', () => {
  it('returns active plans ordered by price', async () => {
    const plans = [
      { id: 'p1', name: 'FREE', price: 0, isActive: true },
      { id: 'p2', name: 'PRO', price: 4.99, isActive: true },
      { id: 'p3', name: 'BUSINESS', price: 19.99, isActive: true },
    ];
    mockDb.plan.findMany.mockResolvedValue(plans);

    const result = await publicCaller().getPlans();

    expect(result).toHaveLength(3);
    expect(mockDb.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// mySubscription
// ──────────────────────────────────────────────────────────────
describe('mySubscription', () => {
  it('returns subscription details for authenticated user', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date('2026-03-22'),
      plan: { name: 'PRO' },
    });

    const result = await authedCaller().mySubscription();

    expect(result.tier).toBe('PRO');
    expect(result.isActive).toBe(true);
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('returns FREE tier when no subscription exists', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    const result = await authedCaller().mySubscription();

    expect(result.tier).toBe('FREE');
    expect(result.isActive).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// createCheckout
// ──────────────────────────────────────────────────────────────
describe('createCheckout', () => {
  it('creates checkout session for valid plan', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.plan.findUnique.mockResolvedValue({
      id: 'p2',
      name: 'PRO',
      stripePriceId: 'price_pro',
    });
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      locale: 'en',
      subscription: null,
    });
    mockCreateCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.com/...',
    } as never);

    const result = await authedCaller().createCheckout({
      planId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    expect(result.checkoutUrl).toBeDefined();
    expect(mockCreateCheckout).toHaveBeenCalled();
  });

  it('throws when Stripe is not configured', async () => {
    mockStripeConfigured.mockReturnValue(false);

    await expect(
      authedCaller().createCheckout({ planId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }),
    ).rejects.toThrow('Payment processing is not configured');
  });

  it('throws for free plan purchase attempt', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.plan.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'FREE',
      stripePriceId: 'price_free',
    });

    await expect(
      authedCaller().createCheckout({ planId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }),
    ).rejects.toThrow('Cannot purchase the free plan');
  });

  it('throws when plan not found', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.plan.findUnique.mockResolvedValue(null);

    await expect(
      authedCaller().createCheckout({ planId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }),
    ).rejects.toThrow('Plan not available for purchase');
  });

  it('throws when plan has no stripePriceId', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.plan.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'PRO',
      stripePriceId: null,
    });

    await expect(
      authedCaller().createCheckout({ planId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }),
    ).rejects.toThrow('Plan not available for purchase');
  });
});

// ──────────────────────────────────────────────────────────────
// createBoostCheckout
// ──────────────────────────────────────────────────────────────
describe('createBoostCheckout', () => {
  it('creates boost checkout for valid listing', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.listing.findFirst.mockResolvedValue({
      id: 'listing-1',
      slug: 'test-listing',
      userId: 'user-1',
    });
    mockDb.listingBoost.findFirst.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      locale: 'en',
      subscription: null,
    });
    mockCreateBoost.mockResolvedValue({
      url: 'https://checkout.stripe.com/...',
    } as never);

    const result = await authedCaller().createBoostCheckout({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      boostType: 'FEATURED',
    });

    expect(result.checkoutUrl).toBeDefined();
  });

  it('throws when listing not found or unauthorized', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.listing.findFirst.mockResolvedValue(null);

    await expect(
      authedCaller().createBoostCheckout({
        listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        boostType: 'FEATURED',
      }),
    ).rejects.toThrow('Listing not found or unauthorized');
  });

  it('throws when listing already has active boost of same type', async () => {
    mockStripeConfigured.mockReturnValue(true);
    mockDb.listing.findFirst.mockResolvedValue({
      id: 'listing-1',
      slug: 'test',
      userId: 'user-1',
    });
    mockDb.listingBoost.findFirst.mockResolvedValue({
      id: 'boost-1',
      type: 'FEATURED',
      endAt: new Date(Date.now() + 86400000),
    });

    await expect(
      authedCaller().createBoostCheckout({
        listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        boostType: 'FEATURED',
      }),
    ).rejects.toThrow('already has an active boost');
  });
});

// ──────────────────────────────────────────────────────────────
// cancel
// ──────────────────────────────────────────────────────────────
describe('cancel', () => {
  it('cancels subscription at period end', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockDb.subscription.update.mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: true,
    });

    const result = await authedCaller().cancel();

    expect(mockCancelSub).toHaveBeenCalledWith('sub_stripe_1');
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it('throws when no active subscription', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await expect(authedCaller().cancel()).rejects.toThrow('No active subscription');
  });
});

// ──────────────────────────────────────────────────────────────
// resume
// ──────────────────────────────────────────────────────────────
describe('resume', () => {
  it('resumes cancelled subscription', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockDb.subscription.update.mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: false,
    });

    const result = await authedCaller().resume();

    expect(mockResumeSub).toHaveBeenCalledWith('sub_stripe_1');
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('throws when no cancelled subscription to resume', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await expect(authedCaller().resume()).rejects.toThrow('No cancelled subscription to resume');
  });

  it('throws when subscription is not marked for cancellation', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: false,
    });

    await expect(authedCaller().resume()).rejects.toThrow('No cancelled subscription to resume');
  });
});

// ──────────────────────────────────────────────────────────────
// createPortalSession
// ──────────────────────────────────────────────────────────────
describe('createPortalSession', () => {
  it('creates portal session for user with billing account', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_123',
    });
    mockDb.user.findUnique.mockResolvedValue({ id: 'user-1', locale: 'en' });
    mockCreatePortal.mockResolvedValue({
      url: 'https://billing.stripe.com/...',
    } as never);

    const result = await authedCaller().createPortalSession();

    expect(result.portalUrl).toBeDefined();
    expect(mockCreatePortal).toHaveBeenCalledWith('cus_123', expect.any(String));
  });

  it('throws when no billing account', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await expect(authedCaller().createPortalSession()).rejects.toThrow('No billing account found');
  });
});

// ──────────────────────────────────────────────────────────────
// getBoostOptions
// ──────────────────────────────────────────────────────────────
describe('getBoostOptions', () => {
  it('returns all boost types with active status', async () => {
    mockDb.listingBoost.findMany.mockResolvedValue([
      { type: 'FEATURED', endAt: new Date(Date.now() + 86400000) },
    ]);

    const result = await authedCaller().getBoostOptions({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    expect(result).toHaveLength(3); // FEATURED, HIGHLIGHTED, TOP
    const featured = result.find((b) => b.type === 'FEATURED');
    expect(featured?.isActive).toBe(true);

    const highlighted = result.find((b) => b.type === 'HIGHLIGHTED');
    expect(highlighted?.isActive).toBe(false);
  });

  it('shows all boosts as inactive when none are active', async () => {
    mockDb.listingBoost.findMany.mockResolvedValue([]);

    const result = await authedCaller().getBoostOptions({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    for (const boost of result) {
      expect(boost.isActive).toBe(false);
    }
  });
});
