import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { resumeSubscription } from "@/server/services/stripe";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription || !subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "No cancelled subscription to resume" },
        { status: 400 }
      );
    }

    if (subscription.stripeSubscriptionId) {
      await resumeSubscription(subscription.stripeSubscriptionId);
    }

    await db.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Billing Resume] Error:", error);
    return NextResponse.json(
      { error: "Failed to resume subscription" },
      { status: 500 }
    );
  }
}
