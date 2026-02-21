import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { searchSchema } from "@/lib/validators";

export const searchRouter = createTRPCRouter({
  /** Full-text search via database (Meilisearch integration in production) */
  search: publicProcedure
    .input(searchSchema)
    .query(async ({ ctx, input }) => {
      const { query, categoryId, locationId, minPrice, maxPrice, page, limit } = input;

      const where: Record<string, unknown> = {
        status: "ACTIVE",
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      };

      if (categoryId) where.categoryId = categoryId;
      if (locationId) where.locationId = locationId;
      if (minPrice || maxPrice) {
        where.price = {
          ...(minPrice ? { gte: minPrice } : {}),
          ...(maxPrice ? { lte: maxPrice } : {}),
        };
      }

      const [listings, total] = await Promise.all([
        ctx.db.listing.findMany({
          where: where as never,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            location: true,
            category: true,
          },
        }),
        ctx.db.listing.count({ where: where as never }),
      ]);

      return { listings, total, page, totalPages: Math.ceil(total / limit) };
    }),

  /** Search suggestions/autocomplete */
  suggest: publicProcedure
    .input(z.object({ query: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const listings = await ctx.db.listing.findMany({
        where: {
          status: "ACTIVE",
          title: { contains: input.query, mode: "insensitive" },
        },
        select: { title: true, categoryId: true },
        take: 5,
        distinct: ["title"],
      });

      const categories = await ctx.db.category.findMany({
        where: {
          isActive: true,
          OR: [
            { slug: { contains: input.query.toLowerCase() } },
          ],
        },
        select: { name: true, slug: true },
        take: 3,
      });

      return { listings, categories };
    }),

  /** Save a search for notifications */
  saveSearch: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      filters: z.record(z.unknown()),
      notifyEmail: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedSearch.create({
        data: {
          userId: ctx.session.user.id!,
          name: input.name,
          filters: input.filters,
          notifyEmail: input.notifyEmail,
        },
      });
    }),

  /** Get my saved searches */
  mySavedSearches: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.savedSearch.findMany({
      where: { userId: ctx.session.user.id! },
      orderBy: { createdAt: "desc" },
    });
  }),
});
