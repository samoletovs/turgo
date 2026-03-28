import { db } from '@/server/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { TrendingUp, TrendingDown, BarChart3, Tag } from 'lucide-react';
import { formatPrice, getLocalizedName } from '@/lib/utils';

interface MarketInsightsProps {
  locale: string;
  translations: {
    title: string;
    listings: string;
    medianPrice: string;
    priceRange: string;
    viewCategory: string;
    poweredBy: string;
    noData: string;
  };
}

export async function MarketInsights({ locale, translations }: MarketInsightsProps) {
  // Fetch the latest market snapshots (from ss.lv scraper data)
  const snapshots = await db.marketSnapshot.findMany({
    orderBy: { date: 'desc' },
    take: 50,
    distinct: ['categoryId'],
    include: {
      category: true,
    },
  });

  if (snapshots.length === 0) {
    return null;
  }

  // Group by category and get the latest for each
  const latestByCategory = snapshots.reduce(
    (acc, snap) => {
      if (!acc[snap.categoryId]) {
        acc[snap.categoryId] = snap;
      }
      return acc;
    },
    {} as Record<string, (typeof snapshots)[number]>,
  );

  const insights = Object.values(latestByCategory).slice(0, 6);

  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">{translations.title}</h2>
          </div>
          <span className="text-xs text-muted-foreground">{translations.poweredBy}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((snapshot) => {
            const categoryName = getLocalizedName(snapshot.category.name, locale);
            const hasRange = snapshot.minPrice != null && snapshot.maxPrice != null;

            return (
              <Link key={snapshot.id} href={`/category/${snapshot.category.slug}`}>
                <Card className="h-full transition-all hover:border-primary hover:shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">{categoryName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {snapshot.listingCount} {translations.listings}
                      </Badge>
                    </div>

                    {snapshot.medianPrice != null && (
                      <div className="mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {translations.medianPrice}:
                        </span>
                        <span className="font-bold text-primary">
                          {formatPrice(snapshot.medianPrice)}
                        </span>
                      </div>
                    )}

                    {hasRange && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                        <span>{formatPrice(snapshot.minPrice!)}</span>
                        <span>—</span>
                        <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                        <span>{formatPrice(snapshot.maxPrice!)}</span>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-primary font-medium">
                      {translations.viewCategory} →
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
