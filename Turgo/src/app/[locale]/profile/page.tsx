import { redirect } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getLocalizedName } from "@/lib/utils";
import {
  User,
  Mail,
  Calendar,
  Settings,
  Package,
  Heart,
  Bot,
  CreditCard,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/listing-card";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  let user:
    | (Awaited<ReturnType<typeof db.user.findUnique>> & {
        subscription?: { plan?: { name: string } } | null;
      })
    | null = null;
  let listings: Awaited<
    ReturnType<
      typeof db.listing.findMany<{
        include: {
          images: { take: 1; orderBy: { sortOrder: "asc" } };
          location: true;
          boosts: { where: { endAt: { gt: Date } } };
        };
      }>
    >
  > = [];
  let favoriteCount = 0;
  let agentCount = 0;

  try {
    [user, listings, favoriteCount, agentCount] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        include: {
          subscription: { include: { plan: true } },
        },
      }),
      db.listing.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          location: true,
          boosts: { where: { endAt: { gt: new Date() } } },
        },
      }),
      db.favorite.count({ where: { userId: session.user.id } }),
      db.sellingAgent.count({
        where: { listing: { userId: session.user.id } },
      }),
    ]);
  } catch (error) {
    console.error("[PROFILE] Database query failed:", error);
  }

  if (!user) redirect(`/${locale}/auth/signin`);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-4">
        {/* Profile Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 text-center">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name || "Profile"}
                  width={96}
                  height={96}
                  className="mx-auto rounded-full"
                />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <h2 className="mt-4 text-xl font-bold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.subscription?.plan && (
                <Badge
                  className="mt-2"
                  variant={
                    user.subscription.plan.name === "FREE"
                      ? "secondary"
                      : "default"
                  }
                >
                  {user.subscription.plan.name} Plan
                </Badge>
              )}
              <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Member since {user.createdAt.toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-6">
              <Link
                href="/profile/listings"
                className="flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-bold">{listings.length}</span>
                <span className="text-xs text-muted-foreground">Listings</span>
              </Link>
              <Link
                href="/favorites"
                className="flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <Heart className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-bold">{favoriteCount}</span>
                <span className="text-xs text-muted-foreground">Favorites</span>
              </Link>
              <Link
                href="/agents"
                className="flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <Bot className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-bold">{agentCount}</span>
                <span className="text-xs text-muted-foreground">Agents</span>
              </Link>
              <Link
                href="/pricing"
                className="flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-bold">
                  {user.subscription?.plan?.name || "Free"}
                </span>
                <span className="text-xs text-muted-foreground">Plan</span>
              </Link>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card>
            <CardContent className="space-y-1 pt-6">
              <Link
                href="/profile/settings"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4" /> Account Settings
              </Link>
              <Link
                href="/messages"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Mail className="h-4 w-4" /> Messages
              </Link>
              <Link
                href="/agents"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Bot className="h-4 w-4" /> My Agents
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Listings</h1>
            <Link href="/sell">
              <Button>Post New Listing</Button>
            </Link>
          </div>

          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No listings yet</h3>
                <p className="text-muted-foreground">
                  Start selling by posting your first listing
                </p>
                <Link href="/sell">
                  <Button className="mt-4">Post a Listing</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing: (typeof listings)[number]) => (
                <ListingCard
                  key={listing.id}
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    price: listing.price,
                    currency: listing.currency,
                    location: listing.location
                      ? getLocalizedName(listing.location.name, locale)
                      : "",
                    imageUrl: listing.images[0]?.url || "/placeholder.svg",
                    imageCount: listing.images.length,
                    createdAt: listing.createdAt,
                    isFeatured: listing.boosts.some(
                      (b: (typeof listing.boosts)[number]) =>
                        b.type === "FEATURED",
                    ),
                    hasAgent: false,
                    slug: listing.slug,
                  }}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
