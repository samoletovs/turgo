import { notFound } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
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
  Pencil,
  BarChart3,
  Eye,
  MessageSquare,
  Target,
  Zap,
  Activity,
} from "lucide-react";
import { auth } from "@/lib/auth";
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
  DeleteListingButton,
} from "./client-components";
import { ImageGallery } from "@/components/image-gallery";
import { ListingJsonLd, BreadcrumbJsonLd } from "@/components/json-ld";
import { LocationMap } from "@/components/maps/LocationMap";
import { APP_URL } from "@/lib/constants";

/** Force dynamic rendering — this page uses auth() which requires cookies() */
export const dynamic = "force-dynamic";

interface ListingPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations("listing");
  const tn = await getTranslations("nav");
  const session = await auth();

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
  const isOwner = session?.user?.id === listing.user.id;

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

  // Build breadcrumb items for JSON-LD
  const breadcrumbItems = [{ name: tn("home"), url: `${APP_URL}/${locale}` }];
  if (listing.category.parent) {
    breadcrumbItems.push({
      name: getLocalizedName(listing.category.parent.name, locale),
      url: `${APP_URL}/${locale}/category/${listing.category.parent.slug}`,
    });
  }
  breadcrumbItems.push({
    name: getLocalizedName(listing.category.name, locale),
    url: `${APP_URL}/${locale}/category/${listing.category.slug}`,
  });
  breadcrumbItems.push({
    name: listing.title,
    url: `${APP_URL}/${locale}/listing/${listing.slug}`,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Structured data */}
      <ListingJsonLd
        name={listing.title}
        description={listing.description}
        price={Number(listing.price)}
        currency={listing.currency}
        image={listing.images[0]?.url}
        url={`${APP_URL}/${locale}/listing/${listing.slug}`}
        condition={listing.condition}
        seller={listing.user.name ? { name: listing.user.name } : undefined}
        datePosted={listing.createdAt.toISOString()}
        category={getLocalizedName(listing.category.name, locale)}
        sku={listing.id}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          {tn("home")}
        </Link>
        <span>/</span>
        {listing.category.parent && (
          <>
            <Link
              href={`/search?category=${listing.category.parent.slug}`}
              className="hover:text-foreground"
            >
              {getLocalizedName(listing.category.parent.name, locale)}
            </Link>
            <span>/</span>
          </>
        )}
        <Link
          href={`/search?category=${listing.category.slug}`}
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
                <Badge className="bg-yellow-500 text-white">
                  {t("featured")}
                </Badge>
              )}
              {listing.sellingAgent && (
                <Badge className="bg-blue-500 text-white">
                  <Bot className="mr-1 h-3 w-3" /> {t("aiAgent")}
                </Badge>
              )}
              {listing.status === "SOLD" && (
                <Badge variant="destructive">{t("statuses.SOLD")}</Badge>
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
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {listing.location.parent
                    ? `${getLocalizedName(listing.location.name, locale)}, ${getLocalizedName(listing.location.parent.name, locale)}`
                    : getLocalizedName(listing.location.name, locale)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatRelativeTime(listing.createdAt)}
              </span>
              <span>
                {listing._count.favorites} {t("favorites")}
              </span>
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
                  <Badge variant="outline">{t("negotiable")}</Badge>
                )}
                <Badge variant="secondary">
                  {listing.condition === "NEW"
                    ? t("conditions.NEW")
                    : listing.condition === "REFURBISHED"
                      ? t("conditions.REFURBISHED")
                      : t("conditions.USED")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">{t("description")}</h2>
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {listing.description}
            </div>
          </div>

          {/* Map */}
          {listing.latitude != null && listing.longitude != null && (
            <div>
              <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t("locationOnMap")}
              </h2>
              {listing.address && (
                <p className="mb-2 text-sm text-muted-foreground">
                  {listing.address}
                </p>
              )}
              <LocationMap
                latitude={listing.latitude}
                longitude={listing.longitude}
                markerLabel={listing.title}
                address={listing.address ?? undefined}
                className="rounded-xl border"
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Owner Actions */}
          {isOwner && (
            <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("manageYourListing")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/listing/${listing.slug}/edit`}>
                  <Button variant="outline" className="w-full">
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("editListing")}
                  </Button>
                </Link>
                <DeleteListingButton listingId={listing.id} locale={locale} />
              </CardContent>
            </Card>
          )}

          {/* Seller Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("seller")}</CardTitle>
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
                    href={`/profile/${listing.user.id}`}
                    className="font-semibold hover:underline"
                  >
                    {listing.user.name || "User"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t("memberSince")} {listing.user.createdAt.getFullYear()}
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

          {/* AI Agent Card — public view (non-owner) */}
          {listing.sellingAgent && !isOwner && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-blue-500" />
                  {t("aiAgent")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("status")}</span>
                  <Badge variant="success">{t("active")}</Badge>
                </div>
                {listing.sellingAgent.autoRespond && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    {t("autoResponding")}
                  </div>
                )}
                {listing.sellingAgent.autoNegotiate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-4 w-4" />
                    {t("dynamicPricing")}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Agent Insights — detailed owner view */}
          {listing.sellingAgent && isOwner && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-blue-500" />
                  {t("agentInsights")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("agentInsightsDesc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Status & Strategy */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("status")}</span>
                  <Badge
                    variant={
                      listing.sellingAgent.status === "ACTIVE"
                        ? "success"
                        : "secondary"
                    }
                  >
                    {listing.sellingAgent.status === "ACTIVE"
                      ? t("active")
                      : t("agentPaused")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("agentStrategy")}
                  </span>
                  <span className="font-medium text-xs">
                    {listing.sellingAgent.sellingStrategyId
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </span>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("agentViews")}
                      </p>
                      <p className="font-semibold">
                        {listing.sellingAgent.totalViews}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("agentInquiries")}
                      </p>
                      <p className="font-semibold">
                        {listing.sellingAgent.totalInquiries}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("agentOffers")}
                      </p>
                      <p className="font-semibold">
                        {listing.sellingAgent.totalOffers}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("agentBestOffer")}
                      </p>
                      <p className="font-semibold">
                        {listing.sellingAgent.bestOfferPrice
                          ? formatPrice(listing.sellingAgent.bestOfferPrice)
                          : t("agentNoOffers")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price Info */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("agentCurrentPrice")}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {formatPrice(listing.sellingAgent.currentPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {t("agentMinPrice")}
                    </p>
                    <p className="font-semibold text-muted-foreground">
                      {formatPrice(listing.sellingAgent.minimumPrice)}
                    </p>
                  </div>
                </div>

                {/* Active features */}
                <div className="space-y-2">
                  {listing.sellingAgent.autoRespond && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span>{t("autoResponding")}</span>
                    </div>
                  )}
                  {listing.sellingAgent.autoNegotiate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span>{t("dynamicPricing")}</span>
                    </div>
                  )}
                </div>

                {/* Link to full dashboard */}
                <Link href={`/agents`}>
                  <Button variant="outline" className="w-full" size="sm">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {t("agentViewAgent")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Safety Tips */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">{t("safetyTips")}</p>
                  <ul className="mt-1 text-xs text-muted-foreground space-y-1">
                    <li>• {t("safetyTip1")}</li>
                    <li>• {t("safetyTip2")}</li>
                    <li>• {t("safetyTip3")}</li>
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
          <h2 className="mb-6 text-xl font-bold">{t("similarListings")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedListings.map((item) => (
              <Link
                key={item.id}
                href={`/listing/${item.slug}`}
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
                      {t("noImage")}
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
