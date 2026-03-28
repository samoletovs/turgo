import { db } from '@/server/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ManualListingForm } from './listing-form-client';

export default async function NewListingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // Require authentication to create a listing
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/auth/signin?callbackUrl=/${locale}/listing/new`);
  }

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
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.location.findMany({
        where: { parentId: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
            orderBy: { name: 'asc' },
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);
    categories = cats as typeof categories;
    locations = locs as typeof locations;
  } catch (e) {
    console.error('Failed to load listing form data:', e);
  }

  return <ManualListingForm locale={locale} categories={categories} locations={locations} />;
}
