import { db } from '@/server/db';
import { getLocalizedName } from '@/lib/utils';
import { searchPublicListings } from '@/server/services/search-read';
import { SearchPageClient } from './search-client';

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

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const requestedPage = Number(filters.page || '1');
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const perPage = 24;
  const [result, categories, locations] = await Promise.all([
    searchPublicListings(
      db,
      {
        query: filters.q || '',
        categorySlug: filters.category,
        locationSlug: filters.location,
        condition: filters.condition,
        countryCode: filters.countryCode,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        sort: filters.sort,
        page,
        limit: perPage,
      },
      false,
    ),
    db.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { listings: { where: { status: 'ACTIVE' } } },
            },
          },
        },
        _count: {
          select: { listings: { where: { status: 'ACTIVE' } } },
        },
      },
    }),
    db.location.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { listings: { where: { status: 'ACTIVE' } } },
        },
      },
    }),
  ]);
  const { listings, total: totalCount, totalPages } = result;
  const selectedCategory = filters.category
    ? await db.category.findUnique({
        where: { slug: filters.category },
        include: { attributes: { orderBy: { sortOrder: 'asc' } } },
      })
    : null;
  const categoryAttributes = selectedCategory?.attributes ?? [];

  // Serialize for client component
  const serializedListings = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    price: Number(listing.price),
    currency: listing.currency,
    condition: listing.condition,
    description: listing.description?.slice(0, 150) || '',
    location: listing.location ? getLocalizedName(listing.location.name, locale) : '',
    locationSlug: listing.location?.slug,
    imageUrl: listing.images[0]?.url || '/placeholder.svg',
    imageCount: listing.images.length,
    createdAt: listing.createdAt.toISOString(),
    isFeatured: listing.boosts.some((b: { type: string }) => b.type === 'FEATURED'),
    hasAgent: listing.managedByAgent || false,
    categoryName:
      typeof listing.category?.name === 'object'
        ? (listing.category.name as Record<string, string>)[locale] ||
          (listing.category.name as Record<string, string>).en ||
          ''
        : String(listing.category?.name || ''),
    favoriteCount: listing._count?.favorites || 0,
    latitude: listing.latitude,
    longitude: listing.longitude,
    viewCount: listing.viewCount,
  }));

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name:
      typeof cat.name === 'object'
        ? (cat.name as Record<string, string>)[locale] ||
          (cat.name as Record<string, string>).en ||
          cat.slug
        : String(cat.name),
    slug: cat.slug,
    icon: cat.icon,
    count: cat._count.listings,
    children: (cat.children || []).map((child) => ({
      id: child.id,
      name:
        typeof child.name === 'object'
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
      typeof loc.name === 'object'
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
      typeof attr.name === 'object'
        ? (attr.name as Record<string, string>)[locale] ||
          (attr.name as Record<string, string>).en ||
          ''
        : String(attr.name),
    type: attr.type as 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN',
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
