import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb } from '@/__tests__/setup';

vi.mock('@/app/[locale]/search/search-client', () => ({
  SearchPageClient: () => null,
}));
vi.mock('@/server/services/search', () => ({
  searchListings: vi.fn().mockResolvedValue({ hits: [], totalHits: 0 }),
}));
vi.mock('@/server/services/search-sync', () => ({
  synchronizeSearch: vi.fn().mockRejectedValue(new Error('Index unavailable')),
  SEARCH_SYNC_LIMIT: 500,
  reportSearchFallback: vi.fn(),
}));

import SearchPage from '@/app/[locale]/search/page';
import { searchListings } from '@/server/services/search';
import { synchronizeSearch } from '@/server/services/search-sync';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.category.findMany.mockResolvedValue([]);
  mockDb.location.findMany.mockResolvedValue([]);
});

describe('public search page', () => {
  it.each([1, 7])(
    'keeps database inventory visible on page %i without a query or a populated search index',
    async (page) => {
      const total = 153;
      const perPage = 24;
      const skip = (page - 1) * perPage;
      const listings = Array.from({ length: Math.min(perPage, total - skip) }, (_, offset) => ({
        id: `synthetic-${skip + offset}`,
        title: '',
        slug: `synthetic-${skip + offset}`,
        price: 1,
        currency: 'EUR',
        condition: 'USED',
        description: '',
        images: [],
        boosts: [],
        category: null,
        location: null,
        createdAt: new Date('2020-01-01T00:00:00Z'),
      }));
      mockDb.listing.findMany.mockResolvedValue(listings);
      mockDb.listing.count.mockResolvedValue(total);

      const result = await SearchPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ page: String(page) }),
      });

      expect(result.props).toMatchObject({
        totalCount: total,
        totalPages: 7,
        currentPage: page,
      });
      expect(result.props.listings).toHaveLength(listings.length);
      expect(result.props.listings).toEqual(
        listings.map(({ id }) => expect.objectContaining({ id })),
      );
      expect(mockDb.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' }, skip, take: perPage }),
      );
      expect(searchListings).not.toHaveBeenCalled();
      expect(synchronizeSearch).toHaveBeenCalledWith(mockDb);
    },
  );
});
