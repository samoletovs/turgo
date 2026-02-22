import { db } from "@/server/db";
import { getLocalizedName } from "@/lib/utils";
import { SearchPageClient } from "./search-client";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
    condition?: string;
    countryCode?: string;
    sort?: string;
    page?: string;
    view?: string; // "grid" | "list" | "map"
  }>;
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
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
    if (filters.minPrice)
      (where.price as Record<string, number>).gte = parseFloat(
        filters.minPrice,
      );
    if (filters.maxPrice)
      (where.price as Record<string, number>).lte = parseFloat(
        filters.maxPrice,
      );
  }

  if (filters.condition) {
    where.condition = filters.condition;
  }

  if (filters.countryCode) {
    where.location = {
      ...((where.location as object) || {}),
      countryCode: filters.countryCode,
    };
  }

  // Determine sort
  const orderBy: Record<string, string> = {};
  switch (filters.sort) {
    case "price_asc":
      orderBy.price = "asc";
      break;
    case "price_desc":
      orderBy.price = "desc";
      break;
    case "oldest":
      orderBy.createdAt = "asc";
      break;
    case "views":
      orderBy.viewCount = "desc";
      break;
    default:
      orderBy.createdAt = "desc";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listings: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let categories: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let locations: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let categoryAttributes: any[] = [];

  try {
    const [listingsResult, countResult, categoriesResult, locationsResult] =
      await Promise.all([
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
          where: { parentId: null, isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: {
                _count: {
                  select: { listings: { where: { status: "ACTIVE" } } },
                },
              },
            },
            _count: {
              select: { listings: { where: { status: "ACTIVE" } } },
            },
          },
        }),
        db.location.findMany({
          where: { parentId: null },
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: { listings: { where: { status: "ACTIVE" } } },
            },
          },
        }),
      ]);

    listings = listingsResult;
    totalCount = countResult;
    categories = categoriesResult;
    locations = locationsResult;

    // Load category-specific attributes if a category is selected
    if (filters.category) {
      const selectedCat = await db.category.findUnique({
        where: { slug: filters.category },
        include: { attributes: { orderBy: { sortOrder: "asc" } } },
      });
      if (selectedCat?.attributes) {
        categoryAttributes = selectedCat.attributes;
      }
    }
  } catch (e) {
    console.error("Failed to load search data:", e);
  }

  const totalPages = Math.ceil(totalCount / perPage);

  // Serialize for client component
  const serializedListings = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    price: listing.price,
    currency: listing.currency,
    condition: listing.condition,
    description: listing.description?.slice(0, 150) || "",
    location: listing.location
      ? getLocalizedName(listing.location.name, locale)
      : "",
    locationSlug: listing.location?.slug,
    imageUrl: listing.images[0]?.url || "/placeholder.jpg",
    imageCount: listing.images.length,
    createdAt: listing.createdAt.toISOString(),
    isFeatured: listing.boosts.some(
      (b: { type: string }) => b.type === "FEATURED",
    ),
    hasAgent: listing.managedByAgent || false,
    categoryName:
      typeof listing.category?.name === "object"
        ? (listing.category.name as Record<string, string>)[locale] ||
          (listing.category.name as Record<string, string>).en ||
          ""
        : String(listing.category?.name || ""),
    favoriteCount: listing._count?.favorites || 0,
    latitude: listing.latitude,
    longitude: listing.longitude,
    viewCount: listing.viewCount,
  }));

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name:
      typeof cat.name === "object"
        ? (cat.name as Record<string, string>)[locale] ||
          (cat.name as Record<string, string>).en ||
          cat.slug
        : String(cat.name),
    slug: cat.slug,
    icon: cat.icon,
    count: cat._count.listings,
    children: (cat.children || []).map((child: typeof cat) => ({
      id: child.id,
      name:
        typeof child.name === "object"
          ? (child.name as Record<string, string>)[locale] ||
            (child.name as Record<string, string>).en ||
            child.slug
          : String(child.name),
      slug: child.slug,
      count: child._count.listings,
    })),
  }));

  const serializedLocations = locations.map((loc) => ({
    id: loc.id,
    name:
      typeof loc.name === "object"
        ? (loc.name as Record<string, string>)[locale] ||
          (loc.name as Record<string, string>).en ||
          loc.slug
        : String(loc.name),
    slug: loc.slug,
    count: loc._count.listings,
  }));

  const serializedAttributes = categoryAttributes.map((attr) => ({
    id: attr.id,
    name:
      typeof attr.name === "object"
        ? (attr.name as Record<string, string>)[locale] ||
          (attr.name as Record<string, string>).en ||
          ""
        : String(attr.name),
    type: attr.type as "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN",
    options: attr.options as string[] | null,
    isRequired: attr.isRequired,
  }));

  return (
    <SearchPageClient
      locale={locale}
      listings={serializedListings}
      categories={serializedCategories}
      locations={serializedLocations}
      categoryAttributes={serializedAttributes}
      filters={filters}
      totalCount={totalCount}
      totalPages={totalPages}
      currentPage={page}
    />
  );
}
