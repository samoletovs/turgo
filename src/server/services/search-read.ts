import type { Prisma, PrismaClient } from '@prisma/client';
import { searchListings, type SearchListingsParams } from './search.ts';
import {
  reportSearchFallback,
  SEARCH_SYNC_LIMIT,
  SearchSyncError,
  synchronizeSearch,
} from './search-sync.ts';

export function publicSearchWhere(params: SearchListingsParams): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: 'ACTIVE' };
  if (params.query) {
    where.OR = [
      { title: { contains: params.query, mode: 'insensitive' } },
      { description: { contains: params.query, mode: 'insensitive' } },
    ];
  }
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.categorySlug) where.category = { slug: params.categorySlug };
  if (params.locationId) where.locationId = params.locationId;
  if (params.locationSlug || params.countryCode) {
    where.location = {
      ...(params.locationSlug ? { slug: params.locationSlug } : {}),
      ...(params.countryCode ? { countryCode: params.countryCode } : {}),
    };
  }
  if (params.condition) {
    const condition = params.condition;
    if (condition !== 'NEW' && condition !== 'USED' && condition !== 'REFURBISHED') {
      throw new Error('Invalid search condition');
    }
    where.condition = condition;
  }
  if (params.minPrice != null || params.maxPrice != null) {
    if (
      (params.minPrice != null && (!Number.isFinite(params.minPrice) || params.minPrice < 0)) ||
      (params.maxPrice != null && (!Number.isFinite(params.maxPrice) || params.maxPrice < 0))
    ) {
      throw new Error('Invalid search price');
    }
    where.price = {
      ...(params.minPrice != null ? { gte: params.minPrice } : {}),
      ...(params.maxPrice != null ? { lte: params.maxPrice } : {}),
    };
  }
  return where;
}

function publicSearchOrder(sort: string | undefined): Prisma.ListingOrderByWithRelationInput {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'oldest':
      return { createdAt: 'asc' };
    case 'views':
      return { viewCount: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

function publicListingSelect(primaryImage: boolean) {
  return {
    id: true,
    title: true,
    slug: true,
    description: true,
    price: true,
    currency: true,
    condition: true,
    status: true,
    negotiable: true,
    categoryId: true,
    locationId: true,
    latitude: true,
    longitude: true,
    managedByAgent: true,
    viewCount: true,
    createdAt: true,
    updatedAt: true,
    category: true,
    location: true,
    images: {
      where: primaryImage ? { isPrimary: true } : undefined,
      orderBy: { sortOrder: 'asc' },
      take: 1,
    },
    _count: { select: { favorites: true } },
    boosts: { where: { endAt: { gt: new Date() } }, select: { type: true } },
  } satisfies Prisma.ListingSelect;
}

export async function searchPublicListings(
  database: PrismaClient,
  params: SearchListingsParams,
  primaryImage = true,
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 24;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid search pagination');
  }
  const where = publicSearchWhere(params);
  let candidateIds: string[] | undefined;
  try {
    await synchronizeSearch(database);
    const result = await searchListings({ ...params, page: 1, limit: SEARCH_SYNC_LIMIT + 1 });
    candidateIds = result.hits.map(({ id }) => id);
    if (
      result.totalHits !== candidateIds.length ||
      candidateIds.length > SEARCH_SYNC_LIMIT ||
      new Set(candidateIds).size !== candidateIds.length
    ) {
      throw new SearchSyncError('parity');
    }
  } catch (error) {
    candidateIds = undefined;
    reportSearchFallback(error);
  }

  // The final DB snapshot is authoritative for privacy, content, filters and pagination.
  // Never return Azure documents/titles, even after a successful reconciliation.
  return database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      const total = await tx.listing.count({ where });
      let verifiedWhere = where;
      if (candidateIds?.length) {
        const matchingWhere: Prisma.ListingWhereInput = {
          AND: [where, { id: { in: candidateIds } }],
        };
        const matched = await tx.listing.count({ where: matchingWhere });
        if (matched === total) {
          verifiedWhere = matchingWhere;
        } else {
          reportSearchFallback(new SearchSyncError('parity'));
        }
      } else if (candidateIds && total > 0) {
        reportSearchFallback(new SearchSyncError('parity'));
      }
      const listings = await tx.listing.findMany({
        where: verifiedWhere,
        orderBy: [publicSearchOrder(params.sort), { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: publicListingSelect(primaryImage),
      });
      return { listings, total, page, totalPages: Math.ceil(total / limit) };
    },
    { isolationLevel: 'RepeatableRead', maxWait: 1000, timeout: 5000 },
  );
}

export async function suggestPublicListings(database: PrismaClient, query: string) {
  const normalized = query.trim().toLowerCase();
  // Reuse the reconciled, hydrated listing path rather than trusting indexed suggestion text.
  const result = await searchPublicListings(database, { query, page: 1, limit: 5 });
  const categories = await database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      return tx.category.findMany({
        where: { isActive: true },
        select: { name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
        take: 50,
      });
    },
    { maxWait: 1000, timeout: 3000 },
  );
  const categorySuggestions = categories
    .flatMap((category) => {
      const names =
        typeof category.name === 'object' && category.name !== null
          ? Object.values(category.name).filter(
              (value): value is string => typeof value === 'string',
            )
          : typeof category.name === 'string'
            ? [category.name]
            : [];
      if (
        !category.slug.toLowerCase().includes(normalized) &&
        !names.some((name) => name.toLowerCase().includes(normalized))
      )
        return [];
      return [{ text: names[0] || category.slug, type: 'category' as const, slug: category.slug }];
    })
    .slice(0, 3);
  return {
    listings: [...new Set(result.listings.map(({ title }) => title))].map((text) => ({
      text,
      type: 'listing' as const,
    })),
    categories: categorySuggestions,
  };
}
