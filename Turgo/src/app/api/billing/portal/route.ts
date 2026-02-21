import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { createPortalSession } from "@/server/services/stripe";
import { APP_URL } from "@/lib/constants";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    const locale = user?.locale || "en";

    const portalSession = await createPortalSession(
      subscription.stripeCustomerId,
      `${APP_URL}/${locale}/dashboard/subscription`
    );

    return NextResponse.json({ portalUrl: portalSession.url });
  } catch (error) {
    console.error("[Billing Portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
