/**
 * Search Service — Meilisearch integration for full-text search
 * Provides indexing, search, suggestions, faceted filtering,
 * bulk sync, geo-search, and saved-search notification helpers.
 */

import {
  MeiliSearch,
  type SearchParams,
  type SearchResponse,
} from "meilisearch";

// ─── Singleton client ────────────────────────────────────

let _client: MeiliSearch | null = null;

function getClient(): MeiliSearch {
  if (!_client) {
    const apiKey = process.env.MEILISEARCH_API_KEY;
    if (!apiKey && process.env.NODE_ENV === "production") {
      throw new Error("MEILISEARCH_API_KEY must be set in production");
    }
    _client = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
      apiKey: apiKey || "masterKey",
    });
  }
  return _client;
}

const LISTINGS_INDEX = "listings";

// ─── Index initialisation ────────────────────────────────

/** Initialize Meilisearch index with settings (call once on app boot) */
export async function initSearchIndex() {
  try {
    const client = getClient();

    // Create the index if it doesn't exist yet
    try {
      await client.createIndex(LISTINGS_INDEX, { primaryKey: "id" });
    } catch {
      /* index already exists — ignore */
    }

    const index = client.index(LISTINGS_INDEX);

    await index.updateSettings({
      searchableAttributes: [
        "title",
        "description",
        "categoryName",
        "locationName",
        "attributeValues",
      ],
      filterableAttributes: [
        "categoryId",
        "categorySlug",
        "locationId",
        "locationSlug",
        "status",
        "condition",
        "price",
        "currency",
        "managedByAgent",
        "countryCode",
        "negotiable",
        "hasImages",
      ],
      sortableAttributes: ["price", "createdAt", "viewCount"],
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
      ],
      // Geo-search for map view
      displayedAttributes: ["*"],
      distinctAttribute: null,
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      },
      faceting: { maxValuesPerFacet: 100 },
      pagination: { maxTotalHits: 10000 },
    });

    console.log("[Search] Meilisearch index initialized");
  } catch (error) {
    console.warn("[Search] Meilisearch not available:", error);
  }
}

// ─── Document types ──────────────────────────────────────

export interface SearchDocument {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  status: string;
  negotiable: boolean;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  locationId?: string;
  locationSlug?: string;
  locationName?: string;
  countryCode?: string;
  managedByAgent: boolean;
  viewCount: number;
  imageUrl?: string;
  imageCount: number;
  hasImages: boolean;
  attributeValues?: string;
  latitude?: number;
  longitude?: number;
  _geo?: { lat: number; lng: number };
  createdAt: number; // epoch ms
}

// ─── Indexing helpers ────────────────────────────────────

/** Convert a listing row into a search document */
export function toSearchDocument(listing: {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency?: string;
  condition: string;
  status: string;
  negotiable?: boolean;
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  locationId?: string;
  locationSlug?: string;
  locationName?: string;
  countryCode?: string;
  managedByAgent: boolean;
  viewCount: number;
  imageUrl?: string;
  imageCount?: number;
  attributeValues?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
}): SearchDocument {
  const doc: SearchDocument = {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency ?? "EUR",
    condition: listing.condition,
    status: listing.status,
    negotiable: listing.negotiable ?? true,
    categoryId: listing.categoryId,
    categorySlug: listing.categorySlug ?? "",
    categoryName: listing.categoryName ?? "",
    locationId: listing.locationId,
    locationSlug: listing.locationSlug ?? "",
    locationName: listing.locationName ?? "",
    countryCode: listing.countryCode,
    managedByAgent: listing.managedByAgent,
    viewCount: listing.viewCount,
    imageUrl: listing.imageUrl,
    imageCount: listing.imageCount ?? 0,
    hasImages: (listing.imageCount ?? 0) > 0,
    attributeValues: listing.attributeValues,
    latitude: listing.latitude ?? undefined,
    longitude: listing.longitude ?? undefined,
    createdAt: listing.createdAt.getTime(),
  };

  // Meilisearch geo-search requires _geo: { lat, lng }
  if (listing.latitude != null && listing.longitude != null) {
    doc._geo = { lat: listing.latitude, lng: listing.longitude };
  }

  return doc;
}

/** Index a single listing */
export async function indexListing(
  listing: Parameters<typeof toSearchDocument>[0],
) {
  try {
    const index = getClient().index(LISTINGS_INDEX);
    await index.addDocuments([toSearchDocument(listing)]);
  } catch (error) {
    console.warn("[Search] Failed to index listing:", error);
  }
}

/** Bulk-index listings (for full re-sync) */
export async function bulkIndexListings(
  listings: Parameters<typeof toSearchDocument>[0][],
) {
  try {
    const index = getClient().index(LISTINGS_INDEX);
    const docs = listings.map(toSearchDocument);
    // Meilisearch recommends batches of ~10 000
    const BATCH = 10_000;
    for (let i = 0; i < docs.length; i += BATCH) {
      await index.addDocuments(docs.slice(i, i + BATCH));
    }
    console.log(`[Search] Bulk-indexed ${docs.length} listings`);
  } catch (error) {
    console.warn("[Search] Bulk index failed:", error);
  }
}

/** Remove a listing from search index */
export async function removeListing(listingId: string) {
  try {
    const index = getClient().index(LISTINGS_INDEX);
    await index.deleteDocument(listingId);
  } catch (error) {
    console.warn("[Search] Failed to remove listing:", error);
  }
}

// ─── Search ──────────────────────────────────────────────

export interface SearchListingsParams {
  query: string;
  categorySlug?: string;
  locationSlug?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  countryCode?: string;
  sort?: string; // "price_asc" | "price_desc" | "newest" | "oldest" | "views"
  page?: number;
  limit?: number;
  /** Geo-filter: center lat/lng + radius in metres */
  geo?: { lat: number; lng: number; radiusM: number };
}

/** Build a Meilisearch filter string from structured params */
function buildFilter(params: SearchListingsParams): string {
  const parts: string[] = ['status = "ACTIVE"'];

  if (params.categorySlug)
    parts.push(`categorySlug = "${params.categorySlug}"`);
  if (params.locationSlug)
    parts.push(`locationSlug = "${params.locationSlug}"`);
  if (params.condition) parts.push(`condition = "${params.condition}"`);
  if (params.countryCode) parts.push(`countryCode = "${params.countryCode}"`);
  if (params.minPrice != null) parts.push(`price >= ${params.minPrice}`);
  if (params.maxPrice != null) parts.push(`price <= ${params.maxPrice}`);

  if (params.geo) {
    parts.push(
      `_geoRadius(${params.geo.lat}, ${params.geo.lng}, ${params.geo.radiusM})`,
    );
  }

  return parts.join(" AND ");
}

/** Convert sort param to Meilisearch sort array */
function buildSort(sort?: string): string[] | undefined {
  switch (sort) {
    case "price_asc":
      return ["price:asc"];
    case "price_desc":
      return ["price:desc"];
    case "oldest":
      return ["createdAt:asc"];
    case "views":
      return ["viewCount:desc"];
    case "newest":
    default:
      return ["createdAt:desc"];
  }
}

/** Full-text search listings with faceted filters & pagination */
export async function searchListings(params: SearchListingsParams): Promise<{
  hits: SearchDocument[];
  totalHits: number;
  page: number;
  totalPages: number;
  processingTimeMs: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 24;

  try {
    const index = getClient().index(LISTINGS_INDEX);

    const searchParams: SearchParams = {
      filter: buildFilter(params),
      sort: buildSort(params.sort),
      offset: (page - 1) * limit,
      limit,
      attributesToHighlight: ["title", "description"],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
    };

    const result: SearchResponse<SearchDocument> = await index.search(
      params.query,
      searchParams,
    );

    const totalHits = result.estimatedTotalHits ?? 0;

    return {
      hits: result.hits as SearchDocument[],
      totalHits,
      page,
      totalPages: Math.ceil(totalHits / limit),
      processingTimeMs: result.processingTimeMs ?? 0,
    };
  } catch (error) {
    console.warn("[Search] Search failed, falling back to empty:", error);
    return { hits: [], totalHits: 0, page, totalPages: 0, processingTimeMs: 0 };
  }
}

// ─── Suggestions / autocomplete ──────────────────────────

export interface SearchSuggestion {
  text: string;
  type: "listing" | "category";
  slug?: string;
  count?: number;
}

/** Fast autocomplete — returns top title matches + matching categories */
export async function searchSuggestions(
  query: string,
  maxResults = 8,
): Promise<SearchSuggestion[]> {
  try {
    const index = getClient().index(LISTINGS_INDEX);
    const result = await index.search(query, {
      limit: maxResults,
      attributesToRetrieve: ["title", "categorySlug", "categoryName"],
    });

    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];

    for (const hit of result.hits) {
      const doc = hit as SearchDocument;
      const key = doc.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ text: doc.title, type: "listing" });
      }
      // Also suggest the category if not already present
      if (doc.categoryName && !seen.has(doc.categorySlug)) {
        seen.add(doc.categorySlug);
        suggestions.push({
          text: doc.categoryName,
          type: "category",
          slug: doc.categorySlug,
        });
      }
    }

    return suggestions.slice(0, maxResults);
  } catch {
    return [];
  }
}

// ─── Saved search match check ────────────────────────────

/** Check if a newly indexed listing matches a saved-search filter set */
export function savedSearchMatchesListing(
  filters: Record<string, unknown>,
  listing: SearchDocument,
): boolean {
  if (filters.categorySlug && filters.categorySlug !== listing.categorySlug)
    return false;
  if (filters.locationSlug && filters.locationSlug !== listing.locationSlug)
    return false;
  if (filters.condition && filters.condition !== listing.condition)
    return false;
  if (filters.minPrice != null && listing.price < (filters.minPrice as number))
    return false;
  if (filters.maxPrice != null && listing.price > (filters.maxPrice as number))
    return false;
  if (filters.countryCode && filters.countryCode !== listing.countryCode)
    return false;
  if (filters.query) {
    const q = (filters.query as string).toLowerCase();
    if (
      !listing.title.toLowerCase().includes(q) &&
      !listing.description.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  return true;
}

// ─── Health check ────────────────────────────────────────

/** Returns true if Meilisearch is reachable */
export async function isSearchHealthy(): Promise<boolean> {
  try {
    const health = await getClient().health();
    return health.status === "available";
  } catch {
    return false;
  }
}
