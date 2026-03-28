import { db } from '@/server/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { SellPageClient } from './sell-client';

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // Require authentication to sell
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/auth/signin?callbackUrl=/${locale}/sell`);
  }

  // Fetch categories + locations for the wizard
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
  let dbError = false;

  try {
    const [cats, locs] = await Promise.all([
      db.category.findMany({
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
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
            select: {
              id: true,
              name: true,
              slug: true,
              children: {
                orderBy: { name: 'asc' },
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      }),
    ]);
    categories = cats as typeof categories;
    locations = locs as typeof locations;
  } catch (e) {
    console.error('Failed to load sell page data:', e);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-md px-4 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sell with AI Agent</h1>
          <p className="text-muted-foreground">
            Service is temporarily unavailable. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return <SellPageClient locale={locale} categories={categories} locations={locations} />;
}
