import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc';
import { searchSchema, type SearchInput } from '@/lib/validators';
import {
  searchListings as meiliSearch,
  searchSuggestions as meiliSuggest,
  savedSearchMatchesListing,
  type SearchDocument,
} from '@/server/services/search';

/** Map a sort key to a Prisma orderBy clause (fallback path) */
function buildPrismaOrderBy(sort: SearchInput['sort']): Prisma.ListingOrderByWithRelationInput {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'oldest':
      return { createdAt: 'asc' };
    case 'views':
      return { viewCount: 'desc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

export const searchRouter = createTRPCRouter({
  /** Full-text search — tries Meilisearch, falls back to Prisma */
  search: publicProcedure.input(searchSchema).query(async ({ ctx, input }) => {
    const {
      query,
      categoryId,
      categorySlug,
      locationId,
      locationSlug,
      condition,
      countryCode,
      minPrice,
      maxPrice,
      sort,
      page,
      limit,
    } = input;

    // ── Try Meilisearch first ──
    try {
      const result = await meiliSearch({
        query,
        categorySlug,
        locationSlug,
        condition,
        countryCode,
        minPrice,
        maxPrice,
        sort,
        page,
        limit,
      });
      if (result.hits.length > 0 || result.totalHits > 0) {
        return {
          listings: result.hits,
          total: result.totalHits,
          page: result.page,
          totalPages: result.totalPages,
        };
      }
    } catch {
      // Meilisearch unavailable — fall through
    }

    // ── Prisma fallback ──
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (categoryId) where.categoryId = categoryId;
    if (categorySlug) where.category = { slug: categorySlug };
    if (locationId) where.locationId = locationId;
    if (locationSlug || countryCode) {
      where.location = {
        ...(locationSlug ? { slug: locationSlug } : {}),
        ...(countryCode ? { countryCode } : {}),
      };
    }
    if (condition) where.condition = condition;
    if (minPrice != null || maxPrice != null) {
      where.price = {
        ...(minPrice != null ? { gte: minPrice } : {}),
        ...(maxPrice != null ? { lte: maxPrice } : {}),
      };
    }

    const [listings, total] = await Promise.all([
      ctx.db.listing.findMany({
        where,
        orderBy: buildPrismaOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          location: true,
          category: true,
        },
      }),
      ctx.db.listing.count({ where }),
    ]);

    return { listings, total, page, totalPages: Math.ceil(total / limit) };
  }),

  /** Search suggestions/autocomplete */
  suggest: publicProcedure
    .input(z.object({ query: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const normalizedQuery = input.query.trim().toLowerCase();

      // Try Meilisearch suggestions first
      try {
        const suggestions = await meiliSuggest(normalizedQuery, 8);
        if (suggestions.length > 0) return suggestions;
      } catch {
        // fall through
      }

      // Database fallback
      const listings = await ctx.db.listing.findMany({
        where: {
          status: 'ACTIVE',
          title: { contains: input.query, mode: 'insensitive' },
        },
        select: { title: true, categoryId: true },
        take: 5,
        distinct: ['title'],
      });

      const categories = await ctx.db.category.findMany({
        where: {
          isActive: true,
        },
        select: { name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
        take: 50,
      });

      const categorySuggestions = categories
        .map((category) => {
          const localizedNames =
            typeof category.name === 'object' && category.name !== null
              ? Object.values(category.name as Record<string, unknown>).filter(
                  (value): value is string => typeof value === 'string',
                )
              : [];
          const categoryLabel =
            localizedNames[0] ||
            (typeof category.name === 'string' ? category.name : category.slug);
          const matchesQuery =
            category.slug.toLowerCase().includes(normalizedQuery) ||
            localizedNames.some((name) => name.toLowerCase().includes(normalizedQuery));

          if (!matchesQuery) return null;

          return {
            text: categoryLabel,
            type: 'category' as const,
            slug: category.slug,
          };
        })
        .filter((category): category is { text: string; type: 'category'; slug: string } =>
          category !== null,
        )
        .slice(0, 3);

      return {
        listings: listings.map((l) => ({
          text: l.title,
          type: 'listing' as const,
        })),
        categories: categorySuggestions,
      };
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
