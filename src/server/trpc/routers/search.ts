import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc';
import { searchSchema } from '@/lib/validators';
import { savedSearchMatchesListing, type SearchDocument } from '@/server/services/search';
import { searchPublicListings, suggestPublicListings } from '@/server/services/search-read';

export const searchRouter = createTRPCRouter({
  /** Reconcile Azure Search, then hydrate/filter authoritative public database records. */
  search: publicProcedure.input(searchSchema).query(async ({ ctx, input }) => {
    return searchPublicListings(ctx.db, input);
  }),

  /** Search suggestions/autocomplete */
  suggest: publicProcedure
    .input(z.object({ query: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      return suggestPublicListings(ctx.db, input.query);
    }),

  /** Save a search for notifications */
  saveSearch: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        filters: z.record(z.string(), z.unknown()),
        notifyEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check plan limits
      const count = await ctx.db.savedSearch.count({
        where: { userId: ctx.session.user.id! },
      });

      // Default limit for free users
      if (count >= 20) {
        throw new Error('Saved search limit reached. Upgrade your plan for more.');
      }

      return ctx.db.savedSearch.create({
        data: {
          userId: ctx.session.user.id!,
          name: input.name,
          filters: input.filters as Prisma.InputJsonValue,
          notifyEmail: input.notifyEmail,
        },
      });
    }),

  /** Delete a saved search */
  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedSearch.delete({
        where: { id: input.id, userId: ctx.session.user.id! },
      });
    }),

  /** Update saved search notification preference */
  updateSavedSearch: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(100).optional(),
        notifyEmail: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.savedSearch.update({
        where: { id, userId: ctx.session.user.id! },
        data,
      });
    }),

  /** Get my saved searches */
  mySavedSearches: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.savedSearch.findMany({
      where: { userId: ctx.session.user.id! },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /** Check saved searches against a new listing (called after indexing) */
  checkSavedSearches: protectedProcedure
    .input(
      z.object({
        listing: z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          description: z.string(),
          price: z.number(),
          currency: z.string().default('EUR'),
          condition: z.string(),
          status: z.string(),
          negotiable: z.boolean().default(true),
          categoryId: z.string(),
          categorySlug: z.string().default(''),
          categoryName: z.string().default(''),
          locationSlug: z.string().default(''),
          locationName: z.string().default(''),
          countryCode: z.string().optional(),
          managedByAgent: z.boolean().default(false),
          viewCount: z.number().default(0),
          imageCount: z.number().default(0),
          hasImages: z.boolean().default(false),
          createdAt: z.number(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find all saved searches with email notifications enabled
      const searches = await ctx.db.savedSearch.findMany({
        where: { notifyEmail: true },
        include: { user: { select: { email: true, name: true } } },
      });

      const matches: { userId: string; email: string; searchName: string }[] = [];

      for (const search of searches) {
        const filters = search.filters as Record<string, unknown>;
        if (savedSearchMatchesListing(filters, input.listing as unknown as SearchDocument)) {
          matches.push({
            userId: search.userId,
            email: search.user.email,
            searchName: search.name,
          });

          // Update last notified timestamp
          await ctx.db.savedSearch.update({
            where: { id: search.id },
            data: { lastNotifiedAt: new Date() },
          });
        }
      }

      return { matchCount: matches.length, matches };
    }),
});
