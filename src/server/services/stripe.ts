/**
 * Stripe Payment Service — Subscriptions, boosts, webhooks
 * Handles plan upgrades, listing boosts, and customer management
 */

import Stripe from 'stripe';
import { BOOST_PRICES } from '@/lib/constants';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key && process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_SECRET_KEY must be set in production');
    }
    if (!key) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not set — using dev placeholder');
    }
    _stripe = new Stripe(key || 'sk_test_placeholder', {
      // @ts-expect-error Stripe SDK expects its bundled LatestApiVersion but we pin to a specific version for stability
      apiVersion: '2025-01-27.acacia',
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    return (getStripe() as unknown as Record<string, unknown>)[prop];
  },
});

/** Check if Stripe is configured */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ──────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ──────────────────────────────────────────────

/** Get or create a Stripe customer for a user */
export async function getOrCreateCustomer(params: {
  userId: string;
  email: string;
  name?: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) {
    return params.existingCustomerId;
  }

  const customer = await getStripe().customers.create({
    email: params.email,
    name: params.name || undefined,
    metadata: { userId: params.userId },
  });

  return customer.id;
}

// ──────────────────────────────────────────────
// SUBSCRIPTION CHECKOUT
// ──────────────────────────────────────────────

/** Create a Stripe Checkout Session for subscription */
export async function createCheckoutSession(params: {
  priceId: string;
  userId: string;
  planId: string;
  customerEmail: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      planId: params.planId,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
        planId: params.planId,
      },
    },
    allow_promotion_codes: true,
  };

  // Use existing customer or create by email
  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_email = params.customerEmail;
  }

  return getStripe().checkout.sessions.create(sessionParams);
}

// ──────────────────────────────────────────────
// LISTING BOOST CHECKOUT
// ──────────────────────────────────────────────

/** Create a one-time payment for listing boost */
export async function createBoostPayment(params: {
  userId: string;
  listingId: string;
  boostType: keyof typeof BOOST_PRICES;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
  customerEmail?: string;
}) {
  const boostConfig = BOOST_PRICES[params.boostType];
  if (!boostConfig) {
    throw new Error(`Invalid boost type: ${params.boostType}`);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${boostConfig.label} Boost`,
            description: `Promote your listing for ${boostConfig.durationDays} days`,
          },
          unit_amount: boostConfig.amount,
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      listingId: params.listingId,
      boostType: params.boostType,
      durationDays: boostConfig.durationDays.toString(),
    },
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else if (params.customerEmail) {
    sessionParams.customer_email = params.customerEmail;
  }

  return getStripe().checkout.sessions.create(sessionParams);
}

// ──────────────────────────────────────────────
// CUSTOMER PORTAL
// ──────────────────────────────────────────────

/** Create Stripe Customer Portal session for managing billing */
export async function createPortalSession(customerId: string, returnUrl: string) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ──────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ──────────────────────────────────────────────

/** Cancel a subscription at period end */
export async function cancelSubscription(subscriptionId: string) {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Resume a cancelled subscription (before period end) */
export async function resumeSubscription(subscriptionId: string) {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/** Change subscription plan (upgrade/downgrade) */
export async function changeSubscriptionPlan(subscriptionId: string, newPriceId: string) {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error('No subscription item found');
  }

  return getStripe().subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
  });
}

// ──────────────────────────────────────────────
// WEBHOOK VERIFICATION
// ──────────────────────────────────────────────

/** Verify Stripe webhook signature */
export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || '',
  );
}
