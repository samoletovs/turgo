import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Heart } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { ListingCard } from "@/components/listing-card";

interface FavoritesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const favorites = await db.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          location: true,
          boosts: { where: { endAt: { gt: new Date() } } },
        },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">My Favorites</h1>

      {favorites.length === 0 ? (
        <div className="py-20 text-center">
          <Heart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No favorites yet</h3>
          <p className="text-muted-foreground">
            Browse listings and tap the heart icon to save your favorites
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block text-primary underline"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((fav: (typeof favorites)[number]) => (
            <ListingCard
              key={fav.id}
              listing={{
                id: fav.listing.id,
                title: fav.listing.title,
                price: fav.listing.price,
                currency: fav.listing.currency,
                location: String(fav.listing.location?.name || ""),
                imageUrl: fav.listing.images[0]?.url || "/placeholder.svg",
                imageCount: fav.listing.images.length,
                createdAt: fav.listing.createdAt,
                isFeatured: fav.listing.boosts.some(
                  (b: (typeof fav.listing.boosts)[number]) =>
                    b.type === "FEATURED",
                ),
                hasAgent: false,
                slug: fav.listing.slug,
              }}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
