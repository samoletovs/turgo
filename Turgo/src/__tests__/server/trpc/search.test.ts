import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "@/__tests__/setup";

// Mock Meilisearch service
vi.mock("@/server/services/search", () => ({
  searchListings: vi.fn(),
  searchSuggestions: vi.fn(),
  savedSearchMatchesListing: vi.fn(),
}));

import {
  searchListings as meiliSearch,
  searchSuggestions as meiliSuggest,
  savedSearchMatchesListing,
} from "@/server/services/search";
import { createCallerFactory } from "@/server/trpc";
import { searchRouter } from "@/server/trpc/routers/search";

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

function authedCaller(userId = "user-1") {
  return createCaller({
    db: mockDb as never,
    session: {
      user: { id: userId, email: "test@test.com", role: "USER", locale: "en" },
      expires: "",
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
describe("search", () => {
  it("returns Meilisearch results when available", async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [{ id: "1", title: "Car" } as never],
      totalHits: 1,
      page: 1,
      totalPages: 1,
      processingTimeMs: 5,
    });

    const result = await publicCaller().search({
      query: "car",
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("falls back to Prisma when Meilisearch returns no results", async () => {
    mockMeiliSearch.mockResolvedValue({
      hits: [],
      totalHits: 0,
      page: 1,
      totalPages: 0,
      processingTimeMs: 0,
    });

    mockDb.listing.findMany.mockResolvedValue([
      {
        id: "2",
        title: "Used Car",
        price: 500,
        images: [],
        location: null,
        category: null,
      },
    ]);
    mockDb.listing.count.mockResolvedValue(1);

    const result = await publicCaller().search({
      query: "car",
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("falls back to Prisma when Meilisearch throws", async () => {
    mockMeiliSearch.mockRejectedValue(new Error("Connection refused"));

    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    const result = await publicCaller().search({
      query: "laptop",
      page: 1,
      limit: 24,
    });

    expect(result.listings).toHaveLength(0);
    expect(mockDb.listing.findMany).toHaveBeenCalled();
  });

  it("applies price filters in Prisma fallback", async () => {
    mockMeiliSearch.mockRejectedValue(new Error("unavailable"));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: "phone",
      minPrice: 100,
      maxPrice: 500,
      page: 1,
      limit: 24,
    });

    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.where.price).toEqual({ gte: 100, lte: 500 });
  });

  it("applies category and location filters in Prisma fallback", async () => {
    mockMeiliSearch.mockRejectedValue(new Error("unavailable"));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await publicCaller().search({
      query: "table",
      categoryId: "cat-1",
      locationId: "loc-1",
      page: 1,
      limit: 24,
    });

    const callArgs = mockDb.listing.findMany.mock.calls[0][0];
    expect(callArgs.where.categoryId).toBe("cat-1");
    expect(callArgs.where.locationId).toBe("loc-1");
  });

  it("paginates Prisma fallback correctly", async () => {
    mockMeiliSearch.mockRejectedValue(new Error("unavailable"));
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(50);

    const result = await publicCaller().search({
      query: "test",
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
describe("suggest", () => {
  it("returns Meilisearch suggestions when available", async () => {
    mockMeiliSuggest.mockResolvedValue([
      { text: "Car", type: "listing" },
      { text: "Electronics", type: "category", slug: "electronics" },
    ]);

    const result = await publicCaller().suggest({ query: "ca" });

    expect(result).toHaveLength(2);
  });

  it("falls back to Prisma when Meilisearch unavailable", async () => {
    mockMeiliSuggest.mockRejectedValue(new Error("unavailable"));
    mockDb.listing.findMany.mockResolvedValue([
      { title: "Honda Civic", categoryId: "cat-1" },
    ]);
    mockDb.category.findMany.mockResolvedValue([
      { name: { en: "Cars" }, slug: "cars" },
    ]);

    const result = await publicCaller().suggest({ query: "honda" });

    expect(result).toHaveProperty("listings");
    expect(result).toHaveProperty("categories");
  });
});

// ──────────────────────────────────────────────────────────────
// saveSearch
// ──────────────────────────────────────────────────────────────
describe("saveSearch", () => {
  it("creates a saved search for authenticated user", async () => {
    mockDb.savedSearch.count.mockResolvedValue(0);
    mockDb.savedSearch.create.mockResolvedValue({
      id: "ss-1",
      name: "Cheap cars",
      filters: { minPrice: 100 },
      notifyEmail: true,
    });

    const result = await authedCaller().saveSearch({
      name: "Cheap cars",
      filters: { minPrice: 100 },
      notifyEmail: true,
    });

    expect(result.name).toBe("Cheap cars");
    expect(mockDb.savedSearch.create).toHaveBeenCalled();
  });

  it("throws when saved search limit reached", async () => {
    mockDb.savedSearch.count.mockResolvedValue(20);

    await expect(
      authedCaller().saveSearch({
        name: "Too many",
        filters: {},
      }),
    ).rejects.toThrow("Saved search limit reached");
  });
});

// ──────────────────────────────────────────────────────────────
// deleteSavedSearch
// ──────────────────────────────────────────────────────────────
describe("deleteSavedSearch", () => {
  it("deletes a saved search owned by the user", async () => {
    mockDb.savedSearch.delete.mockResolvedValue({ id: "ss-1" });

    await authedCaller().deleteSavedSearch({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(mockDb.savedSearch.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "clxxxxxxxxxxxxxxxxxxxxxxxxx", userId: "user-1" },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// mySavedSearches
// ──────────────────────────────────────────────────────────────
describe("mySavedSearches", () => {
  it("returns user's saved searches", async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      { id: "ss-1", name: "Cars" },
      { id: "ss-2", name: "Phones" },
    ]);

    const result = await authedCaller().mySavedSearches();

    expect(result).toHaveLength(2);
    expect(mockDb.savedSearch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// checkSavedSearches
// ──────────────────────────────────────────────────────────────
describe("checkSavedSearches", () => {
  const testListing = {
    id: "listing-1",
    title: "Test Car",
    slug: "test-car",
    description: "A nice car",
    price: 5000,
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
    imageCount: 0,
    hasImages: false,
    createdAt: Date.now(),
  };

  it("finds matching saved searches and notifies", async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      {
        id: "ss-1",
        userId: "u-2",
        name: "Car search",
        filters: { categorySlug: "cars" },
        user: { email: "user@test.com", name: "User" },
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

  it("returns zero matches when no saved searches match", async () => {
    mockDb.savedSearch.findMany.mockResolvedValue([
      {
        id: "ss-1",
        userId: "u-2",
        name: "Phone search",
        filters: { categorySlug: "phones" },
        user: { email: "user@test.com", name: "User" },
      },
    ]);
    mockSavedSearchMatch.mockReturnValue(false);

    const result = await authedCaller().checkSavedSearches({
      listing: testListing,
    });

    expect(result.matchCount).toBe(0);
  });
});
