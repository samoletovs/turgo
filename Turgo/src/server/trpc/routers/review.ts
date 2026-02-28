import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc";
import { sanitizeHtml } from "@/lib/sanitize";

export const reviewRouter = createTRPCRouter({
  /** Create a review for a user (must have had a conversation with them) */
  create: protectedProcedure
    .input(
      z.object({
        revieweeId: z.string().cuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(5).max(2000).optional(),
        listingId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reviewerId = ctx.session.user.id!;

      // Cannot review yourself
      if (reviewerId === input.revieweeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot review yourself",
        });
      }

      // Verify the reviewer has actually interacted with the reviewee
      // via at least one conversation (as buyer or seller)
      const conversation = await ctx.db.conversation.findFirst({
        where: {
          OR: [
            { buyerId: reviewerId, sellerId: input.revieweeId },
            { buyerId: input.revieweeId, sellerId: reviewerId },
          ],
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only review users you have had a conversation with",
        });
      }

      // Prevent duplicate reviews for the same reviewer→reviewee pair
      const existing = await ctx.db.review.findFirst({
        where: {
          reviewerId,
          revieweeId: input.revieweeId,
          ...(input.listingId ? { listingId: input.listingId } : {}),
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already reviewed this user",
        });
      }

      return ctx.db.review.create({
        data: {
          reviewerId,
          revieweeId: input.revieweeId,
          rating: input.rating,
          comment: input.comment ? sanitizeHtml(input.comment) : undefined,
          listingId: input.listingId,
        },
      });
    }),

  /** Get reviews for a user (public) */
  getForUser: publicProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [reviews, total] = await Promise.all([
        ctx.db.review.findMany({
          where: { revieweeId: input.userId },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            reviewer: {
              select: { id: true, name: true, avatar: true },
            },
          },
        }),
        ctx.db.review.count({
          where: { revieweeId: input.userId },
        }),
      ]);

      // Compute average rating
      const stats = await ctx.db.review.aggregate({
        where: { revieweeId: input.userId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      return {
        reviews,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
        averageRating: stats._avg.rating ?? 0,
        totalReviews: stats._count.rating,
      };
    }),
});
