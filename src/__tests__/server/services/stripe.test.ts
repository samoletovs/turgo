import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Stripe SDK with a class (needed for `new Stripe(...)`)
const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockPortalSessionsCreate = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      customers = { create: mockCustomersCreate };
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: mockPortalSessionsCreate } };
      subscriptions = {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
      };
      webhooks = { constructEvent: mockWebhooksConstructEvent };
    },
  };
});

// Set env before importing the module
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

import {
  getOrCreateCustomer,
  createCheckoutSession,
  createBoostPayment,
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  constructWebhookEvent,
  isStripeConfigured,
} from '@/server/services/stripe';

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// getOrCreateCustomer
// ──────────────────────────────────────────────────────────────
describe('getOrCreateCustomer', () => {
  it('returns existing customer ID when provided', async () => {
    const result = await getOrCreateCustomer({
      userId: 'u1',
      email: 'test@test.com',
      existingCustomerId: 'cus_existing',
    });

    expect(result).toBe('cus_existing');
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('creates new customer when no existing ID', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });

    const result = await getOrCreateCustomer({
      userId: 'u1',
      email: 'test@test.com',
      name: 'Test User',
    });

    expect(result).toBe('cus_new');
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@test.com',
      name: 'Test User',
      metadata: { userId: 'u1' },
    });
  });

  it('omits name when not provided', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });

    await getOrCreateCustomer({ userId: 'u1', email: 'test@test.com' });

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@test.com',
      name: undefined,
      metadata: { userId: 'u1' },
    });
  });
});

// ──────────────────────────────────────────────────────────────
// createCheckoutSession
// ──────────────────────────────────────────────────────────────
describe('createCheckoutSession', () => {
  it('creates subscription checkout', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/...',
    });

    const result = await createCheckoutSession({
      priceId: 'price_pro',
      userId: 'u1',
      planId: 'plan-1',
      customerEmail: 'test@test.com',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(result.url).toBeDefined();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_pro', quantity: 1 }],
        client_reference_id: 'u1',
      }),
    );
  });

  it('uses existing customer ID when provided', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1', url: '/' });

    await createCheckoutSession({
      priceId: 'price_pro',
      userId: 'u1',
      planId: 'plan-1',
      customerEmail: 'test@test.com',
      customerId: 'cus_123',
      successUrl: '/success',
      cancelUrl: '/cancel',
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_123' }),
    );
  });

  it('uses customer email when no customer ID', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1', url: '/' });

    await createCheckoutSession({
      priceId: 'price_pro',
      userId: 'u1',
      planId: 'plan-1',
      customerEmail: 'test@test.com',
      successUrl: '/success',
      cancelUrl: '/cancel',
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: 'test@test.com' }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// createBoostPayment
// ──────────────────────────────────────────────────────────────
describe('createBoostPayment', () => {
  it('creates one-time payment for listing boost', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_boost',
      url: 'https://checkout.stripe.com/boost',
    });

    const result = await createBoostPayment({
      userId: 'u1',
      listingId: 'l1',
      boostType: 'FEATURED',
      successUrl: '/success',
      cancelUrl: '/cancel',
    });

    expect(result.url).toBeDefined();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({
          boostType: 'FEATURED',
          listingId: 'l1',
        }),
      }),
    );
  });

  it('throws for invalid boost type', async () => {
    await expect(
      createBoostPayment({
        userId: 'u1',
        listingId: 'l1',
        boostType: 'INVALID' as never,
        successUrl: '/',
        cancelUrl: '/',
      }),
    ).rejects.toThrow('Invalid boost type');
  });
});

// ──────────────────────────────────────────────────────────────
// cancelSubscription / resumeSubscription
// ──────────────────────────────────────────────────────────────
describe('cancelSubscription', () => {
  it('sets cancel_at_period_end to true', async () => {
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1' });

    await cancelSubscription('sub_1');

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: true,
    });
  });
});

describe('resumeSubscription', () => {
  it('sets cancel_at_period_end to false', async () => {
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1' });

    await resumeSubscription('sub_1');

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: false,
    });
  });
});

// ──────────────────────────────────────────────────────────────
// changeSubscriptionPlan
// ──────────────────────────────────────────────────────────────
describe('changeSubscriptionPlan', () => {
  it('changes subscription to new price with proration', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      items: { data: [{ id: 'si_1' }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1' });

    await changeSubscriptionPlan('sub_1', 'price_business');

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', price: 'price_business' }],
      proration_behavior: 'create_prorations',
    });
  });

  it('throws when no subscription item found', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      items: { data: [] },
    });

    await expect(changeSubscriptionPlan('sub_1', 'price_x')).rejects.toThrow(
      'No subscription item found',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// constructWebhookEvent
// ──────────────────────────────────────────────────────────────
describe('constructWebhookEvent', () => {
  it('verifies webhook with signature', () => {
    const event = { id: 'evt_1', type: 'checkout.session.completed' };
    mockWebhooksConstructEvent.mockReturnValue(event);

    const result = constructWebhookEvent('payload', 'sig_123');

    expect(result).toEqual(event);
    expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
      'payload',
      'sig_123',
      expect.any(String),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// isStripeConfigured
// ──────────────────────────────────────────────────────────────
describe('isStripeConfigured', () => {
  it('returns true when STRIPE_SECRET_KEY is set', () => {
    expect(isStripeConfigured()).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// createPortalSession
// ──────────────────────────────────────────────────────────────
describe('createPortalSession', () => {
  it('creates billing portal session', async () => {
    mockPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/...',
    });

    const result = await createPortalSession('cus_123', 'http://localhost/dashboard');

    expect(result.url).toBeDefined();
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://localhost/dashboard',
    });
  });
});
