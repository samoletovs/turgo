import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { searchSuggestions } from "@/server/services/search";
import { db } from "@/server/db";

/**
 * GET /api/search/suggest?q=...
 * Returns autocomplete suggestions from Meilisearch (primary)
 * or database fallback.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // Try Meilisearch first
    const suggestions = await searchSuggestions(q, 8);
    if (suggestions.length > 0) {
      return NextResponse.json(suggestions);
    }
  } catch {
    // Meilisearch unavailable — fall through to DB
  }

  // Database fallback
  try {
    const [listings, categories] = await Promise.all([
      db.listing.findMany({
        where: {
          status: "ACTIVE",
          title: { contains: q, mode: "insensitive" },
        },
        select: { title: true },
        take: 5,
        distinct: ["title"],
      }),
      db.category.findMany({
        where: {
          isActive: true,
          slug: { contains: q.toLowerCase() },
        },
        select: { name: true, slug: true },
        take: 3,
      }),
    ]);

    const results = [
      ...listings.map((l) => ({ text: l.title, type: "listing" as const })),
      ...categories.map((c) => ({
        text: typeof c.name === "object" ? (c.name as Record<string, string>).en || c.slug : String(c.name),
        type: "category" as const,
        slug: c.slug,
      })),
    ];

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
