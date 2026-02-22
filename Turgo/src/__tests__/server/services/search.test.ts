import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Meilisearch client
const mockAddDocuments = vi.fn().mockResolvedValue({ taskUid: 1 });
const mockDeleteDocument = vi.fn().mockResolvedValue({ taskUid: 2 });
const mockSearch = vi.fn();
const mockUpdateSettings = vi.fn().mockResolvedValue({ taskUid: 3 });
const mockCreateIndex = vi.fn().mockResolvedValue({});
const mockHealth = vi.fn();

vi.mock("meilisearch", () => {
  return {
    MeiliSearch: class MockMeiliSearch {
      index() {
        return {
          addDocuments: mockAddDocuments,
          deleteDocument: mockDeleteDocument,
          search: mockSearch,
          updateSettings: mockUpdateSettings,
        };
      }
      createIndex = mockCreateIndex;
      health = mockHealth;
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
} from "@/server/services/search";

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// toSearchDocument
// ──────────────────────────────────────────────────────────────
describe("toSearchDocument", () => {
  const baseListing = {
    id: "l1",
    title: "BMW 3 Series",
    slug: "bmw-3-series",
    description: "Great car",
    price: 15000,
    currency: "EUR",
    condition: "USED",
    status: "ACTIVE",
    negotiable: true,
    categoryId: "cat-1",
    categorySlug: "cars",
    categoryName: "Cars",
    locationId: "loc-1",
    locationSlug: "riga",
    locationName: "Riga",
    countryCode: "LV",
    managedByAgent: false,
    viewCount: 42,
    imageUrl: "https://cdn.turgo.lv/img.jpg",
    imageCount: 3,
    attributeValues: "BMW, 2020, Diesel",
    latitude: 56.95,
    longitude: 24.11,
    createdAt: new Date("2026-01-15"),
  };

  it("converts listing to search document", () => {
    const doc = toSearchDocument(baseListing);

    expect(doc.id).toBe("l1");
    expect(doc.title).toBe("BMW 3 Series");
    expect(doc.price).toBe(15000);
    expect(doc.categorySlug).toBe("cars");
    expect(doc.hasImages).toBe(true);
    expect(doc.createdAt).toBe(baseListing.createdAt.getTime());
  });

  it("adds _geo when lat/lng are present", () => {
    const doc = toSearchDocument(baseListing);

    expect(doc._geo).toEqual({ lat: 56.95, lng: 24.11 });
  });

  it("omits _geo when lat/lng are null", () => {
    const doc = toSearchDocument({
      ...baseListing,
      latitude: null,
      longitude: null,
    });

    expect(doc._geo).toBeUndefined();
  });

  it("defaults hasImages to false when imageCount is 0", () => {
    const doc = toSearchDocument({ ...baseListing, imageCount: 0 });

    expect(doc.hasImages).toBe(false);
  });

  it("defaults currency to EUR", () => {
    const { currency: _, ...withoutCurrency } = baseListing;
    const doc = toSearchDocument(withoutCurrency as typeof baseListing);

    expect(doc.currency).toBe("EUR");
  });

  it("defaults negotiable to true", () => {
    const { negotiable: _, ...withoutNeg } = baseListing;
    const doc = toSearchDocument(withoutNeg as typeof baseListing);

    expect(doc.negotiable).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// searchListings
// ──────────────────────────────────────────────────────────────
describe("searchListings", () => {
  it("returns search results with pagination", async () => {
    mockSearch.mockResolvedValue({
      hits: [{ id: "1", title: "Car" }],
      estimatedTotalHits: 42,
      processingTimeMs: 5,
    });

    const result = await searchListings({ query: "car" });

    expect(result.hits).toHaveLength(1);
    expect(result.totalHits).toBe(42);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2); // ceil(42/24)
    expect(result.processingTimeMs).toBe(5);
  });

  it("builds correct filter with all params", async () => {
    mockSearch.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 0,
    });

    await searchListings({
      query: "phone",
      categorySlug: "electronics",
      locationSlug: "riga",
      condition: "NEW",
      minPrice: 100,
      maxPrice: 500,
      countryCode: "LV",
    });

    const searchCall = mockSearch.mock.calls[0];
    const filter = searchCall[1].filter;
    expect(filter).toContain('status = "ACTIVE"');
    expect(filter).toContain('categorySlug = "electronics"');
    expect(filter).toContain('locationSlug = "riga"');
    expect(filter).toContain('condition = "NEW"');
    expect(filter).toContain("price >= 100");
    expect(filter).toContain("price <= 500");
    expect(filter).toContain('countryCode = "LV"');
  });

  it("applies geo filter when provided", async () => {
    mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });

    await searchListings({
      query: "",
      geo: { lat: 56.95, lng: 24.11, radiusM: 5000 },
    });

    const filter = mockSearch.mock.calls[0][1].filter;
    expect(filter).toContain("_geoRadius(56.95, 24.11, 5000)");
  });

  it("sorts by price ascending", async () => {
    mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });

    await searchListings({ query: "car", sort: "price_asc" });

    expect(mockSearch.mock.calls[0][1].sort).toEqual(["price:asc"]);
  });

  it("sorts by newest by default", async () => {
    mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });

    await searchListings({ query: "car" });

    expect(mockSearch.mock.calls[0][1].sort).toEqual(["createdAt:desc"]);
  });

  it("handles pagination correctly", async () => {
    mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 100 });

    await searchListings({ query: "car", page: 3, limit: 10 });

    expect(mockSearch.mock.calls[0][1].offset).toBe(20);
    expect(mockSearch.mock.calls[0][1].limit).toBe(10);
  });

  it("returns empty results on Meilisearch error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockSearch.mockRejectedValue(new Error("Connection refused"));

    const result = await searchListings({ query: "car" });

    expect(result.hits).toEqual([]);
    expect(result.totalHits).toBe(0);
    warnSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────
// searchSuggestions
// ──────────────────────────────────────────────────────────────
describe("searchSuggestions", () => {
  it("returns listing and category suggestions", async () => {
    mockSearch.mockResolvedValue({
      hits: [
        { title: "Honda Civic", categorySlug: "cars", categoryName: "Cars" },
        { title: "Honda Accord", categorySlug: "cars", categoryName: "Cars" },
      ],
    });

    const result = await searchSuggestions("honda");

    expect(result.some((s) => s.type === "listing")).toBe(true);
    expect(result.some((s) => s.type === "category")).toBe(true);
  });

  it("deduplicates suggestions", async () => {
    mockSearch.mockResolvedValue({
      hits: [
        { title: "Same title", categorySlug: "cat1", categoryName: "Cat" },
        { title: "Same title", categorySlug: "cat1", categoryName: "Cat" },
      ],
    });

    const result = await searchSuggestions("same");

    const listings = result.filter((s) => s.type === "listing");
    expect(listings).toHaveLength(1);
  });

  it("limits results to maxResults", async () => {
    mockSearch.mockResolvedValue({
      hits: Array.from({ length: 20 }, (_, i) => ({
        title: `Item ${i}`,
        categorySlug: `cat-${i}`,
        categoryName: `Cat ${i}`,
      })),
    });

    const result = await searchSuggestions("item", 5);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns empty array on error", async () => {
    mockSearch.mockRejectedValue(new Error("unavailable"));

    const result = await searchSuggestions("test");

    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// savedSearchMatchesListing
// ──────────────────────────────────────────────────────────────
describe("savedSearchMatchesListing", () => {
  const baseListing: SearchDocument = {
    id: "l1",
    title: "BMW 3 Series",
    slug: "bmw",
    description: "A nice car",
    price: 15000,
    currency: "EUR",
    condition: "USED",
    status: "ACTIVE",
    negotiable: true,
    categoryId: "cat-1",
    categorySlug: "cars",
    categoryName: "Cars",
    locationSlug: "riga",
    locationName: "Riga",
    managedByAgent: false,
    viewCount: 0,
    imageCount: 1,
    hasImages: true,
    createdAt: Date.now(),
  };

  it("matches when all filters match", () => {
    expect(
      savedSearchMatchesListing(
        { categorySlug: "cars", minPrice: 10000, maxPrice: 20000 },
        baseListing,
      ),
    ).toBe(true);
  });

  it("rejects on category mismatch", () => {
    expect(
      savedSearchMatchesListing({ categorySlug: "phones" }, baseListing),
    ).toBe(false);
  });

  it("rejects on location mismatch", () => {
    expect(
      savedSearchMatchesListing({ locationSlug: "tallinn" }, baseListing),
    ).toBe(false);
  });

  it("rejects when price below minPrice", () => {
    expect(savedSearchMatchesListing({ minPrice: 20000 }, baseListing)).toBe(
      false,
    );
  });

  it("rejects when price above maxPrice", () => {
    expect(savedSearchMatchesListing({ maxPrice: 10000 }, baseListing)).toBe(
      false,
    );
  });

  it("rejects on condition mismatch", () => {
    expect(savedSearchMatchesListing({ condition: "NEW" }, baseListing)).toBe(
      false,
    );
  });

  it("rejects on country mismatch", () => {
    expect(savedSearchMatchesListing({ countryCode: "EE" }, baseListing)).toBe(
      false,
    );
  });

  it("matches by query in title", () => {
    expect(savedSearchMatchesListing({ query: "BMW" }, baseListing)).toBe(true);
  });

  it("matches by query in description", () => {
    expect(savedSearchMatchesListing({ query: "nice car" }, baseListing)).toBe(
      true,
    );
  });

  it("rejects when query doesn't match title or description", () => {
    expect(savedSearchMatchesListing({ query: "laptop" }, baseListing)).toBe(
      false,
    );
  });

  it("matches with empty filters", () => {
    expect(savedSearchMatchesListing({}, baseListing)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// indexListing / removeListing / bulkIndexListings
// ──────────────────────────────────────────────────────────────
describe("indexListing", () => {
  it("adds document to Meilisearch index", async () => {
    await indexListing({
      id: "l1",
      title: "Car",
      slug: "car",
      description: "Nice",
      price: 1000,
      condition: "USED",
      status: "ACTIVE",
      categoryId: "c1",
      managedByAgent: false,
      viewCount: 0,
      createdAt: new Date(),
    });

    expect(mockAddDocuments).toHaveBeenCalledWith([
      expect.objectContaining({ id: "l1", title: "Car" }),
    ]);
  });

  it("handles indexing error gracefully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAddDocuments.mockRejectedValue(new Error("Connection refused"));

    await expect(
      indexListing({
        id: "l1",
        title: "Car",
        slug: "car",
        description: "Nice",
        price: 1000,
        condition: "USED",
        status: "ACTIVE",
        categoryId: "c1",
        managedByAgent: false,
        viewCount: 0,
        createdAt: new Date(),
      }),
    ).resolves.not.toThrow();

    warnSpy.mockRestore();
  });
});

describe("removeListing", () => {
  it("removes document from index", async () => {
    await removeListing("l1");

    expect(mockDeleteDocument).toHaveBeenCalledWith("l1");
  });
});

describe("bulkIndexListings", () => {
  it("indexes listings in batches", async () => {
    const listings = Array.from({ length: 3 }, (_, i) => ({
      id: `l${i}`,
      title: `Item ${i}`,
      slug: `item-${i}`,
      description: "desc",
      price: 100,
      condition: "NEW",
      status: "ACTIVE",
      categoryId: "c1",
      managedByAgent: false,
      viewCount: 0,
      createdAt: new Date(),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await bulkIndexListings(listings);

    expect(mockAddDocuments).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────
// isSearchHealthy
// ──────────────────────────────────────────────────────────────
describe("isSearchHealthy", () => {
  it("returns true when Meilisearch is available", async () => {
    mockHealth.mockResolvedValue({ status: "available" });

    const result = await isSearchHealthy();

    expect(result).toBe(true);
  });

  it("returns false when Meilisearch is unavailable", async () => {
    mockHealth.mockRejectedValue(new Error("Connection refused"));

    const result = await isSearchHealthy();

    expect(result).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// initSearchIndex
// ──────────────────────────────────────────────────────────────
describe("initSearchIndex", () => {
  it("creates index and updates settings", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await initSearchIndex();

    expect(mockCreateIndex).toHaveBeenCalledWith("listings", {
      primaryKey: "id",
    });
    expect(mockUpdateSettings).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("handles Meilisearch unavailability gracefully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCreateIndex.mockRejectedValue(new Error("Connection refused"));

    await expect(initSearchIndex()).resolves.not.toThrow();

    warnSpy.mockRestore();
  });
});
