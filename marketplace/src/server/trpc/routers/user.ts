import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const userRouter = createTRPCRouter({
  /** Get current user profile */
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id! },
      include: {
        subscription: { include: { plan: true } },
        defaultLocation: true,
        _count: {
          select: {
            listings: true,
            sellingAgents: true,
            buyingAgents: true,
            favorites: true,
          },
        },
      },
    });
  }),

  /** Update profile */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
        locale: z.enum(["en", "lv", "ru", "lt", "et"]).optional(),
        defaultLocationId: z.string().cuid().optional(),
        marketingOptIn: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id! },
        data: input,
      });
    }),

  /** Get user public profile */
  getPublicProfile: protectedProcedure
    .input(z.object({ userId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          _count: { select: { listings: true, reviewsReceived: true } },
          reviewsReceived: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: { rating: true, comment: true, createdAt: true },
          },
        },
      });
    }),

  /** GDPR: Export user data */
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id! },
      include: {
        listings: true,
        favorites: true,
        savedSearches: true,
        sellingAgents: true,
        buyingAgents: true,
      },
    });
    return user;
  }),

  /** GDPR: Delete account */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.delete({
      where: { id: ctx.session.user.id! },
    });
    return { success: true };
  }),
});
