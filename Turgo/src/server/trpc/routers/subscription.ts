import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const subscriptionRouter = createTRPCRouter({
  /** Get available plans */
  getPlans: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
  }),

  /** Get my subscription */
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
      include: { plan: true },
    });
  }),

  /** Create checkout session for upgrading */
  createCheckout: protectedProcedure
    .input(z.object({ planId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.plan.findUnique({
        where: { id: input.planId },
      });

      if (!plan?.stripePriceId) {
        throw new Error("Plan not available for purchase");
      }

      // In production, this would call Stripe to create a checkout session
      // For now, return a placeholder
      return {
        checkoutUrl: `https://checkout.stripe.com/placeholder?plan=${plan.name}`,
      };
    }),

  /** Cancel subscription */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
    });

    if (!subscription) throw new Error("No active subscription");

    // In production, cancel via Stripe API
    return ctx.db.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });
  }),
});
