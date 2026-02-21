/**
 * Stripe Payment Service — Subscriptions, boosts, webhooks
 */

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
});

/** Create a Stripe Checkout Session for subscription */
export async function createCheckoutSession(params: {
  priceId: string;
  userId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    customer_email: params.customerEmail,
    metadata: { userId: params.userId },
  });
}

/** Create a one-time payment for listing boost */
export async function createBoostPayment(params: {
  amount: number; // in cents
  userId: string;
  listingId: string;
  boostType: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${params.boostType} Boost`,
            description: `Promote your listing for ${params.boostType === "FEATURED" ? "7" : "3"} days`,
          },
          unit_amount: params.amount,
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
    },
  });
}

/** Create Stripe Customer Portal session for managing billing */
export async function createPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/** Verify Stripe webhook signature */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ""
  );
}
