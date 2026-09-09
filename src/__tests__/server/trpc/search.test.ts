import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

// Keep the authoritative reader real; mock only external search I/O.
vi.mock('@/server/services/search', () => ({
  searchListings: vi.fn(),
  searchSuggestions: vi.fn(),
  savedSearchMatchesListing: vi.fn(),
  withSearchDeadline: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock('@/server/services/search-sync', () => ({
  synchronizeSearch: vi.fn().mockResolvedValue({ documents: 0, uploaded: 0, deleted: 0 }),
  SEARCH_SYNC_LIMIT: 500,
  SearchSyncError: class extends Error {},
  reportSearchFallback: vi.fn(),
}));

import {
  searchListings as meiliSearch,
  searchSuggestions as meiliSuggest,
  savedSearchMatchesListing,
} from '@/server/services/search';
import { createCallerFactory } from '@/server/trpc';
import { searchRouter } from '@/server/trpc/routers/search';

const mockMeiliSearch = vi.mocked(meiliSearch);
const mockMeiliSuggest = vi.mocked(meiliSuggest);
const mockSavedSearchMatch = vi.mocked(savedSearchMatchesListing);

const createCaller = createCallerFactory(searchRouter);

function publicCaller() {
  return createCaller({
    db: mockDb as never,
    session: null,
    headers: new Headers(),
  });
}

function authedCaller(userId = 'user-1') {
  return createCaller({
    db: mockDb as never,
    session: {
      user: { id: userId, email: 'test@test.com', role: 'USER', locale: 'en' },
      expires: '',
    },
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// search
// ──────────────────────────────────────────────────────────────
describe('search', () => {
  it('returns Meilisearch results when available', async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [{ id: '1', title: 'Car' } as never],
      totalHits: 1,
      page: 1,
      totalPages: 1,
      processingTimeMs: 5,
    });
    mockDb.listing.findMany.mockResolvedValue([{ id: '1', title: 'Car' }]);
    mockDb.listing.count.mockResolvedValue(1);

    const result = await publicCaller().search({
      query: 'car',
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('falls back to Prisma when Meilisearch returns no results', async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [],
      totalHits: 0,
      page: 1,
      totalPages: 0,
      processingTimeMs: 0,
    });

    mockDb.listing.findMany.mockResolvedValue([
      {
        id: '2',
        title: 'Used Car',
        price: 500,
        images: [],
        location: null,
        category: null,
      },
    ]);
    mockDb.listing.count.mockResolvedValue(1);

    const result = await publicCaller().search({
      query: 'car',
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it.each([1, 7])(
    'preserves database results on page %i when a new Azure index is empty',
    async (page) => {
      const total = 153;
      const limit = 24;
      const skip = (page - 1) * limit;
      const listings = Array.from({ length: Math.min(limit, total - skip) }, (_, offset) => ({
        id: `synthetic-${skip + offset}`,
      }));
      mockMeiliSearch.mockResolvedValue({
        hits: [],
        totalHits: 0,
        page,
        totalPages: 0,
        processingTimeMs: 0,
      });
      mockDb.listing.findMany.mockResolvedValue(listings);
      mockDb.listing.count.mockResolvedValue(total);

      const result = await publicCaller().search({ query: 'synthetic', page, limit });

      expect(result).toEqual({ listings, total, page, totalPages: 7 });
      expect(mockDb.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip,
          take: limit,
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
      expect(mockDb.listing.count).toHaveBeenCalled();
    },
  );

  it('falls back to Prisma when Meilisearch throws', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('Connection refused'));

    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    const result = await publicCaller().search({
      query: 'laptop',
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(0);
    expect(mockDb.listing.findMany).toHaveBeenCalled();
  });

  it('applies price filters in Prisma fallback', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: 'phone',
      minPrice: 100,
      maxPrice: 500,
      page: 1,
      limit: 24,
    });

    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.where.price).toEqual({ gte: 100, lte: 500 });
  });

  it('applies category and location filters in Prisma fallback', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: 'table',
      categoryId: 'cat-1',
      locationId: 'loc-1',
      page: 1,
      limit: 24,
    });

    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.where.categoryId).toBe('cat-1');
    expect(callArgs.where.locationId).toBe('loc-1');
  });

  it('applies condition, slug and country filters in Prisma fallback', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: 'bike',
      categorySlug: 'vehicles',
      locationSlug: 'riga',
      condition: 'USED',
      countryCode: 'LV',
      minPrice: 0,
      page: 1,
      limit: 24,
    });

    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.where.category).toEqual({ slug: 'vehicles' });
    expect(callArgs.where.location).toEqual({ slug: 'riga', countryCode: 'LV' });
    expect(callArgs.where.condition).toBe('USED');
    expect(callArgs.where.price).toEqual({ gte: 0 });
  });

  it('sorts Prisma fallback by the requested order', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: 'phone',
      sort: 'price_asc',
      page: 1,
      limit: 24,
    });

    expect(mockDb.listing.findMany.mock.calls[0][0].orderBy).toEqual([
      { price: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('defaults Prisma fallback sort to newest first', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({ query: 'phone', page: 1, limit: 24 });

    expect(mockDb.listing.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('forwards all filters and sort to the search service', async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [],
      totalHits: 0,
      page: 1,
      totalPages: 0,
      processingTimeMs: 0,
    });
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: 'car',
      categorySlug: 'vehicles',
      locationSlug: 'riga',
      condition: 'NEW',
      countryCode: 'LV',
      minPrice: 100,
      maxPrice: 500,
      sort: 'price_desc',
      page: 2,
      limit: 12,
    });

    expect(mockMeiliSearch).toHaveBeenCalledWith({
      query: 'car',
      categorySlug: 'vehicles',
      locationSlug: 'riga',
      condition: 'NEW',
      countryCode: 'LV',
      minPrice: 100,
      maxPrice: 500,
      sort: 'price_desc',
      page: 1,
      limit: 501,
    });
  });

  it('paginates Prisma fallback correctly', async () => {
    mockMeiliSearch.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(50);

    const result = await publicCaller().search({
      query: 'test',
      page: 3,
      limit: 10,
    });

    expect(result.totalPages).toBe(5);
    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(20);
    expect(callArgs.take).toBe(10);
  });
});

// ──────────────────────────────────────────────────────────────
// suggest
// ──────────────────────────────────────────────────────────────
describe('suggest', () => {
  it('returns hydrated suggestions in the same shape as database fallback', async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [],
      totalHits: 0,
      page: 1,
      totalPages: 0,
      processingTimeMs: 0,
    });
    mockDb.listing.findMany.mockResolvedValue([{ id: '1', title: 'Car' }]);
    mockDb.listing.count.mockResolvedValue(1);
    mockDb.category.findMany.mockResolvedValue([]);

    const result = await publicCaller().suggest({ query: 'ca' });

    expect(result).toEqual({ listings: [{ text: 'Car', type: 'listing' }], categories: [] });
    expect(mockMeiliSuggest).not.toHaveBeenCalled();
  });

  it('falls back to Prisma when Meilisearch unavailable', async () => {
    mockMeiliSuggest.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([{ title: 'Honda Civic', categoryId: 'cat-1' }]);
    mockDb.category.findMany.mockResolvedValue([{ name: { en: 'Cars' }, slug: 'cars' }]);

    const result = await publicCaller().suggest({ query: 'honda' });

    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('categories');
  });

  it('matches fallback categories by localized name', async () => {
    mockMeiliSuggest.mockRejectedValue(new Error('unavailable'));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([
      { name: { en: 'Cars', lv: 'Automašīnas' }, slug: 'vehicles' },
      { name: { en: 'Phones' }, slug: 'phones' },
    ]);

    const result = await publicCaller().suggest({ query: 'auto' });

    expect(result).toHaveProperty('categories');
    expect((result as { categories: { slug: string }[] }).categories).toEqual([
      expect.objectContaining({ slug: 'vehicles' }),
    ]);
  });
});

// ──────────────────────────────────────────────────────────────
// saveSearch
// ──────────────────────────────────────────────────────────────
describe('saveSearch', () => {
  it('creates a saved search for authenticated user', async () => {
    mockDb.savedSearch.count.mockResolvedValue(0);
    mockDb.savedSearch.create.mockResolvedValue({
      id: 'ss-1',
      name: 'Cheap cars',
      filters: { minPrice: 100 },
      notifyEmail: true,
    });

    const result = await authedCaller().saveSearch({
      name: 'Cheap cars',
      filters: { minPrice: 100 },
      notifyEmail: true,
    });

    expect(result.name).toBe('Cheap cars');
    expect(mockDb.savedSearch.create).toHaveBeenCalled();
  });

  it('throws when saved search limit reached', async () => {
    mockDb.savedSearch.count.mockResolvedValue(20);

    await expect(
      authedCaller().saveSearch({
        name: 'Too many',
        filters: {},
      }),
    ).rejects.toThrow('Saved search limit reached');
  });
});

// ──────────────────────────────────────────────────────────────
// deleteSavedSearch
// ──────────────────────────────────────────────────────────────
describe('deleteSavedSearch', () => {
  it('deletes a saved search owned by the user', async () => {
    mockDb.savedSearch.delete.mockResolvedValue({ id: 'ss-1' });

    await authedCaller().deleteSavedSearch({
      id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    expect(mockDb.savedSearch.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', userId: 'user-1' },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// mySavedSearches
// ──────────────────────────────────────────────────────────────
describe('mySavedSearches', () => {
  it("returns user's saved searches", async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      { id: 'ss-1', name: 'Cars' },
      { id: 'ss-2', name: 'Phones' },
    ]);

    const result = await authedCaller().mySavedSearches();

    expect(result).toHaveLength(2);
    expect(mockDb.savedSearch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// checkSavedSearches
// ──────────────────────────────────────────────────────────────
describe('checkSavedSearches', () => {
  const testListing = {
    id: 'listing-1',
    title: 'Test Car',
    slug: 'test-car',
    description: 'A nice car',
    price: 5000,
    currency: 'EUR',
    condition: 'USED',
    status: 'ACTIVE',
    negotiable: true,
    categoryId: 'cat-1',
    categorySlug: 'cars',
    categoryName: 'Cars',
    locationSlug: 'riga',
    locationName: 'Riga',
    managedByAgent: false,
    viewCount: 0,
    imageCount: 0,
    hasImages: false,
    createdAt: Date.now(),
  };

  it('finds matching saved searches and notifies', async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      {
        id: 'ss-1',
        userId: 'u-2',
        name: 'Car search',
        filters: { categorySlug: 'cars' },
        user: { email: 'user@test.com', name: 'User' },
      },
    ]);
    mockSavedSearchMatch.mockReturnValue(true);
    mockDb.savedSearch.update.mockResolvedValue({});

    const result = await authedCaller().checkSavedSearches({
      listing: testListing,
    });

    expect(result.matchCount).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(mockDb.savedSearch.update).toHaveBeenCalled();
  });

  it('returns zero matches when no saved searches match', async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      {
        id: 'ss-1',
        userId: 'u-2',
        name: 'Phone search',
        filters: { categorySlug: 'phones' },
        user: { email: 'user@test.com', name: 'User' },
      },
    ]);
    mockSavedSearchMatch.mockReturnValue(false);

    const result = await authedCaller().checkSavedSearches({
      listing: testListing,
    });

    expect(result.matchCount).toBe(0);
  });
});
