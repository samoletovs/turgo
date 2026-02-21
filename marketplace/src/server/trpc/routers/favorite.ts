import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const favoriteRouter = createTRPCRouter({
  /** Toggle favorite on a listing */
  toggle: protectedProcedure
    .input(z.object({ listingId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.favorite.findUnique({
        where: {
          userId_listingId: {
            userId: ctx.session.user.id!,
            listingId: input.listingId,
          },
        },
      });

      if (existing) {
        await ctx.db.favorite.delete({ where: { id: existing.id } });
        return { favorited: false };
      }

      await ctx.db.favorite.create({
        data: {
          userId: ctx.session.user.id!,
          listingId: input.listingId,
        },
      });
      return { favorited: true };
    }),

  /** Get my favorites */
  myFavorites: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const [favorites, total] = await Promise.all([
        ctx.db.favorite.findMany({
          where: { userId: ctx.session.user.id! },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            listing: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
                location: true,
                category: true,
              },
            },
          },
        }),
        ctx.db.favorite.count({ where: { userId: ctx.session.user.id! } }),
      ]);

      return { favorites, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  /** Check if a listing is favorited */
  isFavorited: protectedProcedure
    .input(z.object({ listingId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const fav = await ctx.db.favorite.findUnique({
        where: {
          userId_listingId: {
            userId: ctx.session.user.id!,
            listingId: input.listingId,
          },
        },
      });
      return { favorited: !!fav };
    }),
});
