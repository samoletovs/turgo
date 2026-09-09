import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db';
import { mockDb } from '@/__tests__/setup';
import type { SearchDocument } from '@/server/services/search';

const azure = vi.hoisted(() => ({ search: vi.fn(), sync: vi.fn() }));
vi.mock('@/server/services/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/search')>()),
  searchListings: azure.search,
}));
vi.mock('@/server/services/search-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/search-sync')>()),
  synchronizeSearch: azure.sync,
}));

import { searchPublicListings, suggestPublicListings } from '@/server/services/search-read';
import { SearchSyncError } from '@/server/services/search-sync';

function document(id: string): SearchDocument {
  return {
    id,
    title: 'UNTRUSTED INDEX TEXT',
    slug: id,
    description: 'UNTRUSTED INDEX DESCRIPTION',
    price: 99,
    currency: 'EUR',
    condition: 'USED',
    status: 'ACTIVE',
    negotiable: true,
    categoryId: 'category',
    categorySlug: 'category',
    categoryName: 'Category',
    managedByAgent: false,
    viewCount: 0,
    imageCount: 0,
    hasImages: false,
    createdAt: '2020-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  azure.sync.mockResolvedValue({ documents: 2, uploaded: 0, deleted: 0 });
  azure.search.mockResolvedValue({ hits: [document('one'), document('two')], totalHits: 2 });
  mockDb.listing.count.mockResolvedValue(2);
  mockDb.listing.findMany.mockResolvedValue([{ id: 'one', title: 'Database title', price: 10 }]);
  mockDb.category.findMany.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe('safe request-time search reads', () => {
  it('reconciles before Azure queries and returns only authoritative hydrated records', async () => {
    const result = await searchPublicListings(db, { query: 'title', page: 2, limit: 1 });

    expect(azure.sync).toHaveBeenCalledBefore(azure.search);
    expect(result).toMatchObject({
      listings: [{ id: 'one', title: 'Database title', price: 10 }],
      total: 2,
      page: 2,
      totalPages: 2,
    });
    expect(JSON.stringify(result)).not.toContain('UNTRUSTED');
    expect(mockDb.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
        where: {
          AND: [
            {
              status: 'ACTIVE',
              OR: [
                { title: { contains: 'title', mode: 'insensitive' } },
                { description: { contains: 'title', mode: 'insensitive' } },
              ],
            },
            { id: { in: ['one', 'two'] } },
          ],
        },
        select: expect.not.objectContaining({
          contactEmail: true,
          contactPhone: true,
          userId: true,
        }),
      }),
    );
    expect(mockDb.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      maxWait: 1000,
      timeout: 5000,
    });
  });

  it('falls back when a partial index returns some hits but misses an authoritative match', async () => {
    azure.search.mockResolvedValue({ hits: [document('one')], totalHits: 1 });
    mockDb.listing.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockDb.listing.findMany.mockResolvedValue([{ id: 'one' }, { id: 'missing' }]);

    const result = await searchPublicListings(db, { query: '' });

    expect(result.total).toBe(2);
    expect(result.listings.map(({ id }) => id)).toEqual(['one', 'missing']);
    expect(mockDb.listing.findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE' });
    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ event: 'search_database_fallback', reason: 'parity' }),
    );
  });

  it('removes deleted/private indexed hits at hydration and does not use their text in suggestions', async () => {
    azure.search.mockResolvedValue({ hits: [document('private')], totalHits: 1 });
    mockDb.listing.count.mockResolvedValue(0);
    mockDb.listing.findMany.mockResolvedValue([]);

    const result = await suggestPublicListings(db, 'private');

    expect(result).toEqual({ listings: [], categories: [] });
    expect(JSON.stringify(result)).not.toContain('UNTRUSTED');
    expect(mockDb.listing.findMany.mock.calls[0][0].where).toMatchObject({
      AND: [expect.objectContaining({ status: 'ACTIVE' }), { id: { in: ['private'] } }],
    });
  });

  it.each(['partial', 'busy', 'capacity', 'changed', 'parity'] as const)(
    'uses authoritative fallback when reconciliation is %s',
    async (code) => {
      azure.sync.mockRejectedValue(new SearchSyncError(code));
      const result = await searchPublicListings(db, { query: '' });
      expect(azure.search).not.toHaveBeenCalled();
      expect(result.listings[0].title).toBe('Database title');
      expect(console.warn).toHaveBeenCalledWith(
        JSON.stringify({ event: 'search_database_fallback', reason: code }),
      );
    },
  );

  it('never logs credentials, query text or raw SDK errors on transport failure', async () => {
    azure.search.mockRejectedValue(new Error('api-key=private-key; private title'));

    const result = await searchPublicListings(db, { query: 'private query' });

    expect(result.total).toBe(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/private/);
    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ event: 'search_database_fallback', reason: 'unavailable' }),
    );
  });

  it('preserves category/location IDs, slug/country filters, zero price and sorting in both backends', async () => {
    const input = {
      query: '',
      categoryId: 'cat-id',
      categorySlug: 'cars',
      locationId: 'loc-id',
      locationSlug: 'city',
      countryCode: 'LV',
      condition: 'REFURBISHED',
      minPrice: 0,
      maxPrice: 10,
      sort: 'price_desc',
    };
    await searchPublicListings(db, input);
    expect(azure.search).toHaveBeenCalledWith({ ...input, page: 1, limit: 501 });
    expect(mockDb.listing.count.mock.calls[0][0].where).toEqual({
      status: 'ACTIVE',
      categoryId: 'cat-id',
      category: { slug: 'cars' },
      locationId: 'loc-id',
      location: { slug: 'city', countryCode: 'LV' },
      condition: 'REFURBISHED',
      price: { gte: 0, lte: 10 },
    });
    expect(mockDb.listing.findMany.mock.calls[0][0].orderBy).toEqual([
      { price: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('propagates a database failure instead of inventing a successful empty result', async () => {
    mockDb.listing.count.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(searchPublicListings(db, { query: '' })).rejects.toThrow('Database unavailable');
  });
});
