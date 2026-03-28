/**
 * Search Service — Azure AI Search integration for full-text search
 * Provides indexing, search, suggestions, faceted filtering,
 * bulk sync, geo-search, and saved-search notification helpers.
 */

import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  type SearchOptions,
} from "@azure/search-documents";

// ─── Singleton clients ───────────────────────────────────

let _searchClient: SearchClient<SearchDocument> | null = null;
let _indexClient: SearchIndexClient | null = null;

function getEndpoint(): string {
  return (
    process.env.AZURE_SEARCH_ENDPOINT ||
    "https://search-turgo.search.windows.net"
  );
}

function getCredential(): AzureKeyCredential {
  const key = process.env.AZURE_SEARCH_API_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("AZURE_SEARCH_API_KEY must be set in production");
  }
  return new AzureKeyCredential(key || "dev-key");
}

function getSearchClient(): SearchClient<SearchDocument> {
  if (!_searchClient) {
    _searchClient = new SearchClient<SearchDocument>(
      getEndpoint(),
      LISTINGS_INDEX,
      getCredential(),
    );
  }
  return _searchClient;
}

function getIndexClient(): SearchIndexClient {
  if (!_indexClient) {
    _indexClient = new SearchIndexClient(getEndpoint(), getCredential());
  }
  return _indexClient;
}

const LISTINGS_INDEX = "listings";

// ─── Index initialisation ────────────────────────────────

/** Initialize Azure AI Search index with schema (call once on app boot) */
export async function initSearchIndex() {
  try {
    const indexClient = getIndexClient();

    const indexDef = {
      name: LISTINGS_INDEX,
      fields: [
        { name: "id", type: "Edm.String" as const, key: true, filterable: true },
        { name: "title", type: "Edm.String" as const, searchable: true },
        { name: "slug", type: "Edm.String" as const, filterable: true },
        { name: "description", type: "Edm.String" as const, searchable: true },
        { name: "price", type: "Edm.Double" as const, filterable: true, sortable: true, facetable: true },
        { name: "currency", type: "Edm.String" as const, filterable: true },
        { name: "condition", type: "Edm.String" as const, filterable: true, facetable: true },
        { name: "status", type: "Edm.String" as const, filterable: true },
        { name: "negotiable", type: "Edm.Boolean" as const, filterable: true },
        { name: "categoryId", type: "Edm.String" as const, filterable: true },
        { name: "categorySlug", type: "Edm.String" as const, filterable: true },
        { name: "categoryName", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "locationId", type: "Edm.String" as const, filterable: true },
        { name: "locationSlug", type: "Edm.String" as const, filterable: true },
        { name: "locationName", type: "Edm.String" as const, searchable: true },
        { name: "countryCode", type: "Edm.String" as const, filterable: true },
        { name: "managedByAgent", type: "Edm.Boolean" as const, filterable: true },
        { name: "viewCount", type: "Edm.Int32" as const, sortable: true },
        { name: "imageUrl", type: "Edm.String" as const },
        { name: "imageCount", type: "Edm.Int32" as const },
        { name: "hasImages", type: "Edm.Boolean" as const, filterable: true },
        { name: "attributeValues", type: "Edm.String" as const, searchable: true },
        { name: "location", type: "Edm.GeographyPoint" as const, filterable: true },
        { name: "createdAt", type: "Edm.DateTimeOffset" as const, sortable: true, filterable: true },
      ],
      suggesters: [
        { name: "sg", searchMode: "analyzingInfixMatching" as const, sourceFields: ["title", "categoryName"] },
      ],
      scoringProfiles: [
        {
          name: "boostTitle",
          textWeights: { weights: { title: 3, description: 1, categoryName: 2, attributeValues: 1.5 } },
        },
      ],
      defaultScoringProfile: "boostTitle",
    };

    await indexClient.createOrUpdateIndex(indexDef);
    console.log("[Search] Azure AI Search index initialized");
  } catch (error) {
    console.warn("[Search] Azure AI Search not available:", error);
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
  /** Azure AI Search GeographyPoint (GeoJSON) */
  location?: { type: "Point"; coordinates: [number, number] } | null;
  createdAt: string; // ISO 8601 (Azure AI Search DateTimeOffset)
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
    location: null,
    createdAt: listing.createdAt.toISOString(),
  };

  // Azure AI Search geo: GeoJSON Point [longitude, latitude]
  if (listing.latitude != null && listing.longitude != null) {
    doc.location = {
      type: "Point",
      coordinates: [listing.longitude, listing.latitude],
    };
  }

  return doc;
}

/** Index a single listing */
export async function indexListing(
  listing: Parameters<typeof toSearchDocument>[0],
) {
  try {
    const client = getSearchClient();
    await client.mergeOrUploadDocuments([toSearchDocument(listing)]);
  } catch (error) {
    console.warn("[Search] Failed to index listing:", error);
  }
}

/** Bulk-index listings (for full re-sync) */
export async function bulkIndexListings(
  listings: Parameters<typeof toSearchDocument>[0][],
) {
  try {
    const client = getSearchClient();
    const docs = listings.map(toSearchDocument);
    const BATCH = 1_000; // Azure AI Search max batch size
    for (let i = 0; i < docs.length; i += BATCH) {
      await client.mergeOrUploadDocuments(docs.slice(i, i + BATCH));
    }
    console.log(`[Search] Bulk-indexed ${docs.length} listings`);
  } catch (error) {
    console.warn("[Search] Bulk index failed:", error);
  }
}

/** Remove a listing from search index */
export async function removeListing(listingId: string) {
  try {
    const client = getSearchClient();
    await client.deleteDocuments([{ id: listingId } as SearchDocument]);
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

/** Build an Azure AI Search OData filter string from structured params */
function buildFilter(params: SearchListingsParams): string {
  const parts: string[] = ["status eq 'ACTIVE'"];

  if (params.categorySlug)
    parts.push(`categorySlug eq '${params.categorySlug}'`);
  if (params.locationSlug)
    parts.push(`locationSlug eq '${params.locationSlug}'`);
  if (params.condition) parts.push(`condition eq '${params.condition}'`);
  if (params.countryCode) parts.push(`countryCode eq '${params.countryCode}'`);
  if (params.minPrice != null) parts.push(`price ge ${params.minPrice}`);
  if (params.maxPrice != null) parts.push(`price le ${params.maxPrice}`);

  if (params.geo) {
    parts.push(
      `geo.distance(location, geography'POINT(${params.geo.lng} ${params.geo.lat})') le ${params.geo.radiusM / 1000}`,
    );
  }

  return parts.join(" and ");
}

/** Convert sort param to Azure AI Search orderBy array */
function buildOrderBy(sort?: string): string[] | undefined {
  switch (sort) {
    case "price_asc":
      return ["price asc"];
    case "price_desc":
      return ["price desc"];
    case "oldest":
      return ["createdAt asc"];
    case "views":
      return ["viewCount desc"];
    case "newest":
    default:
      return ["createdAt desc"];
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
    const client = getSearchClient();
    const start = Date.now();

    const searchOptions: SearchOptions<SearchDocument> = {
      filter: buildFilter(params),
      orderBy: buildOrderBy(params.sort),
      skip: (page - 1) * limit,
      top: limit,
      highlightFields: "title,description",
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
      includeTotalCount: true,
    };

    const result = await client.search(params.query || "*", searchOptions);

    const hits: SearchDocument[] = [];
    for await (const r of result.results) {
      hits.push(r.document);
    }

    const totalHits = result.count ?? 0;
    const processingTimeMs = Date.now() - start;

    return {
      hits,
      totalHits,
      page,
      totalPages: Math.ceil(totalHits / limit),
      processingTimeMs,
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
    const client = getSearchClient();
    const result = await client.suggest(query, "sg", {
      top: maxResults,
      select: ["title", "categorySlug", "categoryName"],
    });

    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];

    for (const item of result.results) {
      const key = item.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ text: item.text, type: "listing" });
      }
      // Also suggest the category if available
      const doc = item.document as SearchDocument | undefined;
      if (doc?.categoryName && doc.categorySlug && !seen.has(doc.categorySlug)) {
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

/** Returns true if Azure AI Search is reachable */
export async function isSearchHealthy(): Promise<boolean> {
  try {
    const indexClient = getIndexClient();
    const index = await indexClient.getIndex(LISTINGS_INDEX);
    return !!index;
  } catch {
    return false;
  }
}
