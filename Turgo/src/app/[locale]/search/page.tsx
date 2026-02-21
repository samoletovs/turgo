import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, SlidersHorizontal, MapPin, Grid3X3, List } from "lucide-react";
import { db } from "@/server/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/listing-card";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; location?: string; minPrice?: string; maxPrice?: string; condition?: string; sort?: string; page?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const page = parseInt(filters.page || "1", 10);
  const perPage = 24;

  // Build Prisma where clause
  const where: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.location) {
    where.location = { slug: filters.location };
  }

  if (filters.minPrice || filters.maxPrice) {
    where.price = {};
    if (filters.minPrice) (where.price as Record<string, number>).gte = parseFloat(filters.minPrice);
    if (filters.maxPrice) (where.price as Record<string, number>).lte = parseFloat(filters.maxPrice);
  }

  if (filters.condition) {
    where.condition = filters.condition;
  }

  // Determine sort
  const orderBy: Record<string, string> = {};
  switch (filters.sort) {
    case "price_asc": orderBy.price = "asc"; break;
    case "price_desc": orderBy.price = "desc"; break;
    case "oldest": orderBy.createdAt = "asc"; break;
    default: orderBy.createdAt = "desc";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listings: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let categories: any[] = [];

  try {
    const [listingsResult, countResult, categoriesResult] = await Promise.all([
      db.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          category: true,
          location: true,
          _count: { select: { favorites: true } },
          boosts: { where: { endAt: { gt: new Date() } } },
        },
      }),
      db.listing.count({ where }),
      db.category.findMany({
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
      }),
    ]);
    listings = listingsResult;
    totalCount = countResult;
    categories = categoriesResult;
  } catch (e) {
    console.error("Failed to load search data:", e);
  }

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search listings..."
              defaultValue={filters.q || ""}
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="space-y-6">
            {/* Categories */}
            <div>
              <h3 className="mb-3 font-semibold">Categories</h3>
              <div className="space-y-1">
                {categories.map((cat: typeof categories[number]) => (
                  <Link
                    key={cat.id}
                    href={`/${locale}/search?category=${cat.slug}${filters.q ? `&q=${filters.q}` : ""}`}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      filters.category === cat.slug ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <span>{String(cat.name)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cat._count.listings}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <h3 className="mb-3 font-semibold">Price Range</h3>
              <form className="flex items-center gap-2">
                <Input
                  name="minPrice"
                  type="number"
                  placeholder="Min"
                  defaultValue={filters.minPrice}
                  className="w-full"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  name="maxPrice"
                  type="number"
                  placeholder="Max"
                  defaultValue={filters.maxPrice}
                  className="w-full"
                />
                <Button type="submit" size="sm" variant="outline">
                  Go
                </Button>
              </form>
            </div>

            {/* Condition */}
            <div>
              <h3 className="mb-3 font-semibold">Condition</h3>
              <div className="space-y-1">
                {["NEW", "USED", "REFURBISHED"].map((cond) => (
                  <Link
                    key={cond}
                    href={`/${locale}/search?condition=${cond}${filters.q ? `&q=${filters.q}` : ""}${filters.category ? `&category=${filters.category}` : ""}`}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      filters.condition === cond ? "bg-muted font-medium" : ""
                    }`}
                  >
                    {cond.charAt(0) + cond.slice(1).toLowerCase()}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {/* Results header */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? "result" : "results"}
              {filters.q && <span> for &quot;{filters.q}&quot;</span>}
            </p>
            <div className="flex items-center gap-2">
              <select
                defaultValue={filters.sort || "newest"}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </div>
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No results found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing: typeof listings[number]) => (
                <ListingCard
                  key={listing.id}
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    price: listing.price,
                    currency: listing.currency,
                    location: String(listing.location?.name || ""),
                    imageUrl: listing.images[0]?.url || "/placeholder.jpg",
                    imageCount: listing.images.length,
                    createdAt: listing.createdAt,
                    isFeatured: listing.boosts.some((b: typeof listing.boosts[number]) => b.type === "FEATURED"),
                    hasAgent: false,
                    slug: listing.slug,
                  }}
                  locale={locale}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/${locale}/search?page=${page - 1}${filters.q ? `&q=${filters.q}` : ""}${filters.category ? `&category=${filters.category}` : ""}`}
                >
                  <Button variant="outline" size="sm">Previous</Button>
                </Link>
              )}
              <span className="px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/${locale}/search?page=${page + 1}${filters.q ? `&q=${filters.q}` : ""}${filters.category ? `&category=${filters.category}` : ""}`}
                >
                  <Button variant="outline" size="sm">Next</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
