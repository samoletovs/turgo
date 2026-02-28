import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { generatePageMetadata } from "@/lib/seo";
import { EditListingClient } from "./edit-listing-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "editListing" });

  const listing = await db.listing.findFirst({
    where: { slug },
    select: { title: true },
  });

  return generatePageMetadata({
    title: listing ? `${t("title")} — ${listing.title}` : t("title"),
    description: t("subtitle"),
    path: `/listing/${slug}/edit`,
    locale,
    noIndex: true,
  });
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/signin`);

  // Fetch the listing with ownership check
  const listing = await db.listing.findFirst({
    where: { slug, userId: session.user.id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: { include: { parent: true } },
      location: { include: { parent: true } },
    },
  });

  if (!listing) notFound();

  // Fetch categories & locations for form
  type JsonName = string | Record<string, string>;
  let categories: {
    id: string;
    name: JsonName;
    slug: string;
    children?: { id: string; name: JsonName; slug: string }[];
  }[] = [];
  let locations: {
    id: string;
    name: JsonName;
    slug: string;
    children?: { id: string; name: JsonName; slug: string }[];
  }[] = [];

  try {
    const [cats, locs] = await Promise.all([
      db.category.findMany({
        where: { parentId: null, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.location.findMany({
        where: { parentId: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);
    categories = cats as typeof categories;
    locations = locs as typeof locations;
  } catch (e) {
    console.error("Failed to load edit form data:", e);
  }

  // Serialize listing data for client
  const listingData = {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    negotiable: listing.negotiable,
    condition: listing.condition,
    categoryId: listing.category?.parentId ?? listing.categoryId,
    subcategoryId: listing.category?.parentId ? listing.categoryId : "",
    locationId: listing.location?.parentId ?? listing.locationId ?? "",
    sublocationId: listing.location?.parentId ? (listing.locationId ?? "") : "",
    contactPhone: listing.contactPhone ?? "",
    contactEmail: listing.contactEmail ?? "",
    address: listing.address ?? "",
    status: listing.status,
    images: listing.images.map((img) => ({
      id: img.id,
      url: img.url,
      isPrimary: img.isPrimary,
    })),
  };

  return (
    <EditListingClient
      locale={locale}
      listing={listingData}
      categories={categories}
      locations={locations}
    />
  );
}
