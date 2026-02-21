/**
 * Search Service — Meilisearch integration for full-text search
 */

import { MeiliSearch } from "meilisearch";

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
  apiKey: process.env.MEILISEARCH_API_KEY || "masterKey",
});

const LISTINGS_INDEX = "listings";

/** Initialize Meilisearch index with settings */
export async function initSearchIndex() {
  try {
    const index = client.index(LISTINGS_INDEX);

    await index.updateSettings({
      searchableAttributes: ["title", "description", "categoryName", "locationName"],
      filterableAttributes: [
        "categoryId",
        "locationId",
        "status",
        "condition",
        "price",
        "managedByAgent",
        "countryCode",
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
    });

    console.log("[Search] Meilisearch index initialized");
  } catch (error) {
    console.warn("[Search] Meilisearch not available:", error);
  }
}

/** Index a listing for search */
export async function indexListing(listing: {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  status: string;
  categoryId: string;
  categoryName?: string;
  locationId?: string;
  locationName?: string;
  countryCode?: string;
  managedByAgent: boolean;
  viewCount: number;
  imageUrl?: string;
  createdAt: Date;
}) {
  try {
    const index = client.index(LISTINGS_INDEX);
    await index.addDocuments([
      {
        ...listing,
        createdAt: listing.createdAt.getTime(),
      },
    ]);
  } catch (error) {
    console.warn("[Search] Failed to index listing:", error);
  }
}

/** Remove a listing from search index */
export async function removeListing(listingId: string) {
  try {
    const index = client.index(LISTINGS_INDEX);
    await index.deleteDocument(listingId);
  } catch (error) {
    console.warn("[Search] Failed to remove listing:", error);
  }
}

/** Search listings */
export async function searchListings(params: {
  query: string;
  filters?: string;
  sort?: string[];
  page?: number;
  limit?: number;
}) {
  try {
    const index = client.index(LISTINGS_INDEX);
    return index.search(params.query, {
      filter: params.filters,
      sort: params.sort,
      offset: ((params.page ?? 1) - 1) * (params.limit ?? 24),
      limit: params.limit ?? 24,
    });
  } catch (error) {
    console.warn("[Search] Search failed:", error);
    return { hits: [], estimatedTotalHits: 0 };
  }
}
