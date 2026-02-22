import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/trpc";
import {
  createCheckoutSession,
  createBoostPayment,
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
  isStripeConfigured,
} from "@/server/services/stripe";
import { APP_URL, BOOST_PRICES } from "@/lib/constants";

export const subscriptionRouter = createTRPCRouter({
  /** Get available plans (public for pricing page) */
  getPlans: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
  }),

  /** Get my current subscription + plan details */
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
      include: { plan: true },
    });

    return {
      subscription,
      tier: subscription?.plan.name || "FREE",
      isActive: subscription?.status === "ACTIVE",
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      currentPeriodEnd: subscription?.currentPeriodEnd,
    };
  }),

  /** Create checkout session for subscribing/upgrading */
  createCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payment processing is not configured",
        });
      }

      const plan = await ctx.db.plan.findUnique({
        where: { id: input.planId },
      });

      if (!plan || !plan.stripePriceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Plan not available for purchase",
        });
      }

      if (plan.name === "FREE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot purchase the free plan",
        });
      }

      // Get user + existing subscription
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id! },
        include: { subscription: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const locale = user.locale || "en";
      const existingCustomerId = user.subscription?.stripeCustomerId;

      const session = await createCheckoutSession({
        priceId: plan.stripePriceId,
        userId: user.id,
        planId: plan.id,
        customerEmail: user.email,
        customerId: existingCustomerId,
        successUrl: `${APP_URL}/${locale}/dashboard?checkout=success`,
        cancelUrl: `${APP_URL}/${locale}/pricing?checkout=cancelled`,
      });

      return { checkoutUrl: session.url };
    }),

  /** Create a listing boost purchase */
  createBoostCheckout: protectedProcedure
    .input(
      z.object({
        listingId: z.string().cuid(),
        boostType: z.enum(["FEATURED", "HIGHLIGHTED", "TOP"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payment processing is not configured",
        });
      }

      // Verify the listing belongs to the user
      const listing = await ctx.db.listing.findFirst({
        where: { id: input.listingId, userId: ctx.session.user.id! },
      });

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found or unauthorized",
        });
      }

      // Check if already boosted
      const existingBoost = await ctx.db.listingBoost.findFirst({
        where: {
          listingId: input.listingId,
          type: input.boostType,
          endAt: { gte: new Date() },
        },
      });

      if (existingBoost) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This listing already has an active boost of this type",
        });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id! },
        include: { subscription: true },
      });

      const locale = user?.locale || "en";

      const session = await createBoostPayment({
        userId: ctx.session.user.id!,
        listingId: input.listingId,
        boostType: input.boostType,
        successUrl: `${APP_URL}/${locale}/listing/${listing.slug}?boost=success`,
        cancelUrl: `${APP_URL}/${locale}/listing/${listing.slug}?boost=cancelled`,
        customerId: user?.subscription?.stripeCustomerId,
        customerEmail: user?.email,
      });

      return { checkoutUrl: session.url };
    }),

  /** Open Stripe customer portal for billing management */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
    });

    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No billing account found. Subscribe to a plan first.",
      });
    }

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id! },
    });

    const locale = user?.locale || "en";

    const session = await createPortalSession(
      subscription.stripeCustomerId,
      `${APP_URL}/${locale}/dashboard`,
    );

    return { portalUrl: session.url };
  }),

  /** Cancel subscription (at period end) */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
    });

    if (!subscription) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active subscription",
      });
    }

    // Cancel via Stripe if we have a subscription ID
    if (subscription.stripeSubscriptionId) {
      await cancelSubscription(subscription.stripeSubscriptionId);
    }

    return ctx.db.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });
  }),

  /** Resume a cancelled subscription */
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
    });

    if (!subscription || !subscription.cancelAtPeriodEnd) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No cancelled subscription to resume",
      });
    }

    if (subscription.stripeSubscriptionId) {
      await resumeSubscription(subscription.stripeSubscriptionId);
    }

    return ctx.db.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false },
    });
  }),

  /** Get boost options + pricing for a listing */
  getBoostOptions: protectedProcedure
    .input(z.object({ listingId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Check current boosts
      const activeBoosts = await ctx.db.listingBoost.findMany({
        where: {
          listingId: input.listingId,
          endAt: { gte: new Date() },
        },
      });

      const activeTypes: string[] = activeBoosts.map((b) => b.type);

      return Object.entries(BOOST_PRICES).map(([type, config]) => ({
        type,
        label: config.label,
        priceEur: config.amount / 100,
        durationDays: config.durationDays,
        isActive: activeTypes.includes(type),
      }));
    }),
});
