import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  MapPin,
  Clock,
  Share2,
  Shield,
  User,
  Phone,
  Bot,
  TrendingDown,
} from "lucide-react";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, formatRelativeTime, getLocalizedName } from "@/lib/utils";
import {
  ViewTracker,
  FavoriteButton,
  SendMessageButton,
  ReportButton,
} from "./client-components";
import { ImageGallery } from "@/components/image-gallery";

interface ListingPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { locale, slug } = await params;
  const _t = await getTranslations("listing");

  const listing = await db.listing.findFirst({
    where: { slug, status: { in: ["ACTIVE", "SOLD"] } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: { include: { parent: true } },
      location: { include: { parent: true } },
      user: { select: { id: true, name: true, avatar: true, createdAt: true } },
      sellingAgent: true,
      _count: { select: { favorites: true } },
      boosts: { where: { endAt: { gt: new Date() } } },
    },
  });

  if (!listing) notFound();

  const isFeatured = listing.boosts.some((b) => b.type === "FEATURED");

  // Fetch related listings
  const relatedListings = await db.listing.findMany({
    where: {
      categoryId: listing.categoryId,
      id: { not: listing.id },
      status: "ACTIVE",
    },
    take: 4,
    orderBy: { createdAt: "desc" },
    include: {
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      location: true,
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        {listing.category.parent && (
          <>
            <Link
              href={`/${locale}/search?category=${listing.category.parent.slug}`}
              className="hover:text-foreground"
            >
              {getLocalizedName(listing.category.parent.name, locale)}
            </Link>
            <span>/</span>
          </>
        )}
        <Link
          href={`/${locale}/search?category=${listing.category.slug}`}
          className="hover:text-foreground"
        >
          {getLocalizedName(listing.category.name, locale)}
        </Link>
      </nav>

      <ViewTracker listingId={listing.id} />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <div className="relative">
            <ImageGallery
              images={listing.images.map((img, idx) => ({
                url: img.url,
                alt: `${listing.title} — photo ${idx + 1}`,
              }))}
            />

            {/* Badges */}
            <div className="absolute left-4 top-4 z-10 flex gap-2 pointer-events-none">
              {isFeatured && (
                <Badge className="bg-yellow-500 text-white">Featured</Badge>
              )}
              {listing.sellingAgent && (
                <Badge className="bg-blue-500 text-white">
                  <Bot className="mr-1 h-3 w-3" /> AI Agent
                </Badge>
              )}
              {listing.status === "SOLD" && (
                <Badge variant="destructive">Sold</Badge>
              )}
            </div>
          </div>

          {/* Title & Price */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold lg:text-3xl">
                {listing.title}
              </h1>
              <div className="flex gap-2">
                <FavoriteButton
                  listingId={listing.id}
                  initialCount={listing._count.favorites}
                />
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {listing.location.parent
                    ? `${String(listing.location.name)}, ${String(listing.location.parent.name)}`
                    : String(listing.location.name)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatRelativeTime(listing.createdAt)}
              </span>
              <span>{listing._count.favorites} favorites</span>
            </div>
          </div>

          {/* Price */}
          <div className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(listing.price, listing.currency)}
              </span>
              <div className="flex items-center gap-2">
                {listing.negotiable && (
                  <Badge variant="outline">Negotiable</Badge>
                )}
                <Badge variant="secondary">
                  {listing.condition === "NEW"
                    ? "New"
                    : listing.condition === "REFURBISHED"
                      ? "Refurbished"
                      : "Used"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Description</h2>
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {listing.description}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Seller Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {listing.user.avatar ? (
                  <Image
                    src={listing.user.avatar}
                    alt={listing.user.name || "Seller"}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <Link
                    href={`/${locale}/profile/${listing.user.id}`}
                    className="font-semibold hover:underline"
                  >
                    {listing.user.name || "User"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Member since {listing.user.createdAt.getFullYear()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <SendMessageButton
                  listingId={listing.id}
                  sellerId={listing.user.id}
                  locale={locale}
                />
                {listing.contactPhone && (
                  <Button variant="outline" className="w-full">
                    <Phone className="mr-2 h-4 w-4" />
                    {listing.contactPhone}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Agent Card */}
          {listing.sellingAgent && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-blue-500" />
                  AI Selling Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success">Active</Badge>
                </div>
                {listing.sellingAgent.autoRespond && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Auto-responding to inquiries
                  </div>
                )}
                {listing.sellingAgent.autoNegotiate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-4 w-4" />
                    Dynamic pricing enabled
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Safety Tips */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Safety tips</p>
                  <ul className="mt-1 text-xs text-muted-foreground space-y-1">
                    <li>• Meet in a safe, public place</li>
                    <li>• Don&apos;t pay in advance</li>
                    <li>• Inspect the item before paying</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report */}
          <div className="flex justify-center">
            <ReportButton listingId={listing.id} locale={locale} />
          </div>
        </div>
      </div>

      {/* Related Listings */}
      {relatedListings.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-6 text-xl font-bold">Similar Listings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedListings.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/listing/${item.slug}`}
                className="group overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3]">
                  {item.images[0] ? (
                    <Image
                      src={item.images[0].url}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-sm font-bold text-primary">
                    {formatPrice(item.price, item.currency)}
                  </p>
                  {item.location && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(item.location.name)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
