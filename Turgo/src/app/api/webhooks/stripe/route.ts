import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/server/db";
import { constructWebhookEvent } from "@/server/services/stripe";
import { BOOST_PRICES } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("[STRIPE_WEBHOOK] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id;
        const planId = session.metadata?.planId;
        const boostType = session.metadata?.boostType;

        if (boostType && session.metadata?.listingId) {
          // Handle boost payment
          const boostConfig = BOOST_PRICES[boostType as keyof typeof BOOST_PRICES];
          const durationDays = boostConfig?.durationDays || parseInt(session.metadata?.durationDays || "7", 10);

          await db.listingBoost.create({
            data: {
              listingId: session.metadata.listingId,
              type: boostType as "FEATURED" | "HIGHLIGHTED" | "TOP",
              startAt: new Date(),
              endAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
              stripePaymentId: session.payment_intent as string,
            },
          });

          console.log(`[STRIPE_WEBHOOK] Boost ${boostType} created for listing ${session.metadata.listingId}`);
        } else if (userId && planId) {
          // Handle subscription checkout
          const stripeCustomerId = session.customer as string;

          await db.subscription.upsert({
            where: { userId },
            update: {
              planId,
              status: "ACTIVE",
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ),
              cancelAtPeriodEnd: false,
            },
            create: {
              userId,
              planId,
              status: "ACTIVE",
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ),
            },
          });

          console.log(`[STRIPE_WEBHOOK] Subscription created/updated for user ${userId}, plan ${planId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const existingSub = await db.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (existingSub) {
          const periodStart = (subscription as unknown as Record<string, number>).current_period_start;
          const periodEnd = (subscription as unknown as Record<string, number>).current_period_end;
          await db.subscription.update({
            where: { id: existingSub.id },
            data: {
              status:
                subscription.status === "active"
                  ? "ACTIVE"
                  : subscription.status === "past_due"
                  ? "PAST_DUE"
                  : "CANCELLED",
              currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const existingSub = await db.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (existingSub) {
          // Downgrade to free plan
          const freePlan = await db.plan.findFirst({
            where: { name: "FREE" },
          });

          if (freePlan) {
            await db.subscription.update({
              where: { id: existingSub.id },
              data: {
                planId: freePlan.id,
                status: "ACTIVE",
                stripeSubscriptionId: null,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(
                  Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
                ),
              },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | undefined;
        if (subscriptionId) {
          const existingSub = await db.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (existingSub) {
            await db.subscription.update({
              where: { id: existingSub.id },
              data: { status: "PAST_DUE" },
            });
          }
        }
        break;
      }

      default:
        console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK] Error processing event:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
