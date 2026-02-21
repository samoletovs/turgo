import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { ListingCard } from "@/components/listing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params;
  const filters = await searchParams;
  const page = parseInt(filters.page || "1", 10);
  const perPage = 24;

  const category = await db.category.findFirst({
    where: { slug },
    include: {
      parent: true,
      children: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
      },
      _count: { select: { listings: true } },
    },
  });

  if (!category) notFound();

  // Get categoryIds to include (this category + all children)
  const categoryIds = [category.id, ...category.children.map((c) => c.id)];

  const orderBy: Record<string, string> = {};
  switch (filters.sort) {
    case "price_asc": orderBy.price = "asc"; break;
    case "price_desc": orderBy.price = "desc"; break;
    default: orderBy.createdAt = "desc";
  }

  const [listings, totalCount] = await Promise.all([
    db.listing.findMany({
      where: { categoryId: { in: categoryIds }, status: "ACTIVE" },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        category: true,
        location: true,
        boosts: { where: { endAt: { gt: new Date() } } },
      },
    }),
    db.listing.count({
      where: { categoryId: { in: categoryIds }, status: "ACTIVE" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3 w-3" />
        {category.parent && (
          <>
            <Link
              href={`/${locale}/category/${category.parent.slug}`}
              className="hover:text-foreground"
            >
              {String(category.parent.name)}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground">{String(category.name)}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{String(category.name)}</h1>
        <p className="mt-1 text-muted-foreground">{totalCount} listings</p>
      </div>

      {/* Subcategories */}
      {category.children.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {category.children.map((sub: typeof category.children[number]) => (
            <Link key={sub.id} href={`/${locale}/category/${sub.slug}`}>
              <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">
                {String(sub.name)}
                <span className="ml-1.5 text-muted-foreground">({sub._count.listings})</span>
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-2 text-lg font-semibold">No listings yet</p>
          <p className="text-muted-foreground">
            Be the first to post in this category
          </p>
          <Link href={`/${locale}/sell`}>
            <Button className="mt-4">Post a listing</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <Link href={`/${locale}/category/${slug}?page=${page - 1}`}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          <span className="px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/${locale}/category/${slug}?page=${page + 1}`}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
