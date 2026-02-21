import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { createCheckoutSession, isStripeConfigured } from "@/server/services/stripe";
import { APP_URL } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Payment processing is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: "Plan not found or not purchasable" }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const locale = user.locale || "en";

    const checkoutSession = await createCheckoutSession({
      priceId: plan.stripePriceId,
      userId: user.id,
      planId: plan.id,
      customerEmail: user.email,
      customerId: user.subscription?.stripeCustomerId,
      successUrl: `${APP_URL}/${locale}/dashboard?checkout=success`,
      cancelUrl: `${APP_URL}/${locale}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    console.error("[Checkout API] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
