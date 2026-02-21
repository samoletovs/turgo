import { db } from "@/server/db";
import { ManualListingForm } from "./listing-form-client";

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let categories: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[] = [];
  let locations: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[] = [];

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
    console.error("Failed to load listing form data:", e);
  }

  return (
    <ManualListingForm
      locale={locale}
      categories={categories}
      locations={locations}
    />
  );
}
