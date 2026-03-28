import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Azure AI Search clients
const mockMergeOrUploadDocuments = vi.fn().mockResolvedValue({ results: [] });
const mockDeleteDocuments = vi.fn().mockResolvedValue({ results: [] });
const mockSearchResults = vi.fn();
const mockSuggestResults = vi.fn();
const mockCreateOrUpdateIndex = vi.fn().mockResolvedValue({});
const mockGetIndex = vi.fn();

vi.mock('@azure/search-documents', () => {
  return {
    SearchClient: class MockSearchClient {
      mergeOrUploadDocuments = mockMergeOrUploadDocuments;
      deleteDocuments = mockDeleteDocuments;
      search = mockSearchResults;
      suggest = mockSuggestResults;
    },
    SearchIndexClient: class MockSearchIndexClient {
      createOrUpdateIndex = mockCreateOrUpdateIndex;
      getIndex = mockGetIndex;
    },
    AzureKeyCredential: class MockAzureKeyCredential {
      constructor(_key: string) {}
    },
  };
});

import {
  toSearchDocument,
  searchListings,
  searchSuggestions,
  savedSearchMatchesListing,
  isSearchHealthy,
  indexListing,
  removeListing,
  bulkIndexListings,
  initSearchIndex,
  type SearchDocument,
} from '@/server/services/search';

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// toSearchDocument
// ──────────────────────────────────────────────────────────────
describe('toSearchDocument', () => {
  const baseListing = {
    id: 'l1',
    title: 'BMW 3 Series',
    slug: 'bmw-3-series',
    description: 'Great car',
    price: 15000,
    currency: 'EUR',
    condition: 'USED',
    status: 'ACTIVE',
    negotiable: true,
    categoryId: 'cat-1',
    categorySlug: 'cars',
    categoryName: 'Cars',
    locationId: 'loc-1',
    locationSlug: 'riga',
    locationName: 'Riga',
    countryCode: 'LV',
    managedByAgent: false,
    viewCount: 42,
    imageUrl: 'https://cdn.turgo.lv/img.jpg',
    imageCount: 3,
    attributeValues: 'BMW, 2020, Diesel',
    latitude: 56.95,
    longitude: 24.11,
    createdAt: new Date('2026-01-15'),
  };

  it('converts listing to search document', () => {
    const doc = toSearchDocument(baseListing);

    expect(doc.id).toBe('l1');
    expect(doc.title).toBe('BMW 3 Series');
    expect(doc.price).toBe(15000);
    expect(doc.categorySlug).toBe('cars');
    expect(doc.hasImages).toBe(true);
    expect(doc.createdAt).toBe(baseListing.createdAt.toISOString());
  });

  it('adds location GeoJSON when lat/lng are present', () => {
    const doc = toSearchDocument(baseListing);

    expect(doc.location).toEqual({
      type: 'Point',
      coordinates: [24.11, 56.95],
    });
  });

  it('sets location to null when lat/lng are null', () => {
    const doc = toSearchDocument({
      ...baseListing,
      latitude: null,
      longitude: null,
    });

    expect(doc.location).toBeNull();
  });

  it('defaults hasImages to false when imageCount is 0', () => {
    const doc = toSearchDocument({ ...baseListing, imageCount: 0 });

    expect(doc.hasImages).toBe(false);
  });

  it('defaults currency to EUR', () => {
    const { currency: _, ...withoutCurrency } = baseListing;
    const doc = toSearchDocument(withoutCurrency as typeof baseListing);

    expect(doc.currency).toBe('EUR');
  });

  it('defaults negotiable to true', () => {
    const { negotiable: _, ...withoutNeg } = baseListing;
    const doc = toSearchDocument(withoutNeg as typeof baseListing);

    expect(doc.negotiable).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// searchListings
// ──────────────────────────────────────────────────────────────
describe('searchListings', () => {
  it('returns search results with pagination', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {
        yield { document: { id: '1', title: 'Car' } };
      })(),
      count: 42,
    });

    const result = await searchListings({ query: 'car' });

    expect(result.hits).toHaveLength(1);
    expect(result.totalHits).toBe(42);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2); // ceil(42/24)
  });

  it('builds correct OData filter with all params', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {})(),
      count: 0,
    });

    await searchListings({
      query: 'phone',
      categorySlug: 'electronics',
      locationSlug: 'riga',
      condition: 'NEW',
      minPrice: 100,
      maxPrice: 500,
      countryCode: 'LV',
    });

    const searchCall = mockSearchResults.mock.calls[0];
    const filter = searchCall[1].filter;
    expect(filter).toContain("status eq 'ACTIVE'");
    expect(filter).toContain("categorySlug eq 'electronics'");
    expect(filter).toContain("locationSlug eq 'riga'");
    expect(filter).toContain("condition eq 'NEW'");
    expect(filter).toContain('price ge 100');
    expect(filter).toContain('price le 500');
    expect(filter).toContain("countryCode eq 'LV'");
  });

  it('applies geo filter when provided', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {})(),
      count: 0,
    });

    await searchListings({
      query: '',
      geo: { lat: 56.95, lng: 24.11, radiusM: 5000 },
    });

    const filter = mockSearchResults.mock.calls[0][1].filter;
    expect(filter).toContain("geo.distance(location, geography'POINT(24.11 56.95)') le 5");
  });

  it('sorts by price ascending', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {})(),
      count: 0,
    });

    await searchListings({ query: 'car', sort: 'price_asc' });

    expect(mockSearchResults.mock.calls[0][1].orderBy).toEqual(['price asc']);
  });

  it('sorts by newest by default', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {})(),
      count: 0,
    });

    await searchListings({ query: 'car' });

    expect(mockSearchResults.mock.calls[0][1].orderBy).toEqual(['createdAt desc']);
  });

  it('handles pagination correctly', async () => {
    mockSearchResults.mockResolvedValue({
      results: (async function* () {})(),
      count: 100,
    });

    await searchListings({ query: 'car', page: 3, limit: 10 });

    expect(mockSearchResults.mock.calls[0][1].skip).toBe(20);
    expect(mockSearchResults.mock.calls[0][1].top).toBe(10);
  });

  it('returns empty results on Azure AI Search error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSearchResults.mockRejectedValue(new Error('Connection refused'));

    const result = await searchListings({ query: 'car' });

    expect(result.hits).toEqual([]);
    expect(result.totalHits).toBe(0);
    warnSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────
// searchSuggestions
// ──────────────────────────────────────────────────────────────
describe('searchSuggestions', () => {
  it('returns listing and category suggestions', async () => {
    mockSuggestResults.mockResolvedValue({
      results: [
        {
          text: 'Honda Civic',
          document: { title: 'Honda Civic', categorySlug: 'cars', categoryName: 'Cars' },
        },
        {
          text: 'Honda Accord',
          document: { title: 'Honda Accord', categorySlug: 'cars', categoryName: 'Cars' },
        },
      ],
    });

    const result = await searchSuggestions('honda');

    expect(result.some((s) => s.type === 'listing')).toBe(true);
    expect(result.some((s) => s.type === 'category')).toBe(true);
  });

  it('deduplicates suggestions', async () => {
    mockSuggestResults.mockResolvedValue({
      results: [
        {
          text: 'Same title',
          document: { title: 'Same title', categorySlug: 'cat1', categoryName: 'Cat' },
        },
        {
          text: 'Same title',
          document: { title: 'Same title', categorySlug: 'cat1', categoryName: 'Cat' },
        },
      ],
    });

    const result = await searchSuggestions('same');

    const listings = result.filter((s) => s.type === 'listing');
    expect(listings).toHaveLength(1);
  });

  it('limits results to maxResults', async () => {
    mockSuggestResults.mockResolvedValue({
      results: Array.from({ length: 20 }, (_, i) => ({
        text: `Item ${i}`,
        document: { title: `Item ${i}`, categorySlug: `cat-${i}`, categoryName: `Cat ${i}` },
      })),
    });

    const result = await searchSuggestions('item', 5);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array on error', async () => {
    mockSuggestResults.mockRejectedValue(new Error('unavailable'));

    const result = await searchSuggestions('test');

    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// savedSearchMatchesListing
// ──────────────────────────────────────────────────────────────
describe('savedSearchMatchesListing', () => {
  const baseListing: SearchDocument = {
    id: 'l1',
    title: 'BMW 3 Series',
    slug: 'bmw',
    description: 'A nice car',
    price: 15000,
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
    imageCount: 1,
    hasImages: true,
    createdAt: new Date().toISOString(),
  };

  it('matches when all filters match', () => {
    expect(
      savedSearchMatchesListing(
        { categorySlug: 'cars', minPrice: 10000, maxPrice: 20000 },
        baseListing,
      ),
    ).toBe(true);
  });

  it('rejects on category mismatch', () => {
    expect(savedSearchMatchesListing({ categorySlug: 'phones' }, baseListing)).toBe(false);
  });

  it('rejects on location mismatch', () => {
    expect(savedSearchMatchesListing({ locationSlug: 'tallinn' }, baseListing)).toBe(false);
  });

  it('rejects when price below minPrice', () => {
    expect(savedSearchMatchesListing({ minPrice: 20000 }, baseListing)).toBe(false);
  });

  it('rejects when price above maxPrice', () => {
    expect(savedSearchMatchesListing({ maxPrice: 10000 }, baseListing)).toBe(false);
  });

  it('rejects on condition mismatch', () => {
    expect(savedSearchMatchesListing({ condition: 'NEW' }, baseListing)).toBe(false);
  });

  it('rejects on country mismatch', () => {
    expect(savedSearchMatchesListing({ countryCode: 'EE' }, baseListing)).toBe(false);
  });

  it('matches by query in title', () => {
    expect(savedSearchMatchesListing({ query: 'BMW' }, baseListing)).toBe(true);
  });

  it('matches by query in description', () => {
    expect(savedSearchMatchesListing({ query: 'nice car' }, baseListing)).toBe(true);
  });

  it("rejects when query doesn't match title or description", () => {
    expect(savedSearchMatchesListing({ query: 'laptop' }, baseListing)).toBe(false);
  });

  it('matches with empty filters', () => {
    expect(savedSearchMatchesListing({}, baseListing)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// indexListing / removeListing / bulkIndexListings
// ──────────────────────────────────────────────────────────────
describe('indexListing', () => {
  it('uploads document to Azure AI Search index', async () => {
    await indexListing({
      id: 'l1',
      title: 'Car',
      slug: 'car',
      description: 'Nice',
      price: 1000,
      condition: 'USED',
      status: 'ACTIVE',
      categoryId: 'c1',
      managedByAgent: false,
      viewCount: 0,
      createdAt: new Date(),
    });

    expect(mockMergeOrUploadDocuments).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'l1', title: 'Car' }),
    ]);
  });

  it('handles indexing error gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMergeOrUploadDocuments.mockRejectedValue(new Error('Connection refused'));

    await expect(
      indexListing({
        id: 'l1',
        title: 'Car',
        slug: 'car',
        description: 'Nice',
        price: 1000,
        condition: 'USED',
        status: 'ACTIVE',
        categoryId: 'c1',
        managedByAgent: false,
        viewCount: 0,
        createdAt: new Date(),
      }),
    ).resolves.not.toThrow();

    warnSpy.mockRestore();
  });
});

describe('removeListing', () => {
  it('removes document from index', async () => {
    await removeListing('l1');

    expect(mockDeleteDocuments).toHaveBeenCalledWith([{ id: 'l1' }]);
  });
});

describe('bulkIndexListings', () => {
  it('indexes listings in batches', async () => {
    const listings = Array.from({ length: 3 }, (_, i) => ({
      id: `l${i}`,
      title: `Item ${i}`,
      slug: `item-${i}`,
      description: 'desc',
      price: 100,
      condition: 'NEW',
      status: 'ACTIVE',
      categoryId: 'c1',
      managedByAgent: false,
      viewCount: 0,
      createdAt: new Date(),
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await bulkIndexListings(listings);

    expect(mockMergeOrUploadDocuments).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────
// isSearchHealthy
// ──────────────────────────────────────────────────────────────
describe('isSearchHealthy', () => {
  it('returns true when Azure AI Search is available', async () => {
    mockGetIndex.mockResolvedValue({ name: 'listings' });

    const result = await isSearchHealthy();

    expect(result).toBe(true);
  });

  it('returns false when Azure AI Search is unavailable', async () => {
    mockGetIndex.mockRejectedValue(new Error('Connection refused'));

    const result = await isSearchHealthy();

    expect(result).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// initSearchIndex
// ──────────────────────────────────────────────────────────────
describe('initSearchIndex', () => {
  it('creates or updates index with schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initSearchIndex();

    expect(mockCreateOrUpdateIndex).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'listings' }),
    );
    logSpy.mockRestore();
  });

  it('handles Azure AI Search unavailability gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreateOrUpdateIndex.mockRejectedValue(new Error('Connection refused'));

    await expect(initSearchIndex()).resolves.not.toThrow();

    warnSpy.mockRestore();
  });
});
