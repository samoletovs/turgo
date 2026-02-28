import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Search,
  Bot,
  Zap,
  TrendingUp,
  ArrowRight,
  Car,
  Home,
  Smartphone,
  Sofa,
  Shirt,
  Briefcase,
  Wrench,
  Baby,
  Dumbbell,
  PawPrint,
  Palette,
  Tractor,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MarketInsights } from "@/components/market-insights";
import { HeroTabbed } from "@/components/hero-tabbed";
import { db } from "@/server/db";
import { ListingCard } from "@/components/listing-card";
import { getLocalizedName } from "@/lib/utils";

/** ISR: revalidate every 60 seconds for fresh featured listings */
export const revalidate = 60;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  transport: Car,
  "real-estate": Home,
  electronics: Smartphone,
  "home-garden": Sofa,
  fashion: Shirt,
  jobs: Briefcase,
  services: Wrench,
  "kids-baby": Baby,
  "sports-outdoors": Dumbbell,
  pets: PawPrint,
  "hobbies-leisure": Palette,
  agriculture: Tractor,
};

const CATEGORIES = [
  { slug: "transport" },
  { slug: "real-estate" },
  { slug: "electronics" },
  { slug: "home-garden" },
  { slug: "fashion" },
  { slug: "jobs" },
  { slug: "services" },
  { slug: "kids-baby" },
  { slug: "sports-outdoors" },
  { slug: "pets" },
  { slug: "hobbies-leisure" },
  { slug: "agriculture" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  // Fetch latest active listings for the homepage
  type ListingWithRelations = Awaited<
    ReturnType<typeof db.listing.findMany>
  >[number] & {
    images: { url: string }[];
    location: { name: string | Record<string, string> } | null;
    boosts: { type: string; endAt: Date }[];
    managedByAgent: boolean;
  };
  let latestListings: ListingWithRelations[] = [];
  try {
    latestListings = (await db.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        category: true,
        location: true,
        boosts: { where: { endAt: { gt: new Date() } } },
      },
    })) as unknown as ListingWithRelations[];
  } catch {
    // DB may not be available yet — page still renders
  }

  return (
    <>
      {/* Tabbed Hero section */}
      <HeroTabbed locale={locale} />

      {/* Categories grid */}
      <section id="categories" className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-6 text-2xl font-bold">{t("popularCategories")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.slug] || Briefcase;
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                >
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium text-center">
                    {t(`categories.${cat.slug}`)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest Listings */}
      {latestListings.length > 0 && (
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t("recentlyAdded")}</h2>
              <Link
                href="/search"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {tCommon("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {latestListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    slug: listing.slug,
                    price: Number(listing.price),
                    currency: listing.currency,
                    location: listing.location
                      ? getLocalizedName(listing.location.name, locale)
                      : undefined,
                    imageUrl: listing.images[0]?.url || undefined,
                    imageCount: listing.images.length,
                    createdAt: listing.createdAt,
                    isFeatured: listing.boosts?.some(
                      (b: { type: string }) => b.type === "FEATURED",
                    ),
                    hasAgent: listing.managedByAgent,
                  }}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Market Insights from ss.lv */}
      <MarketInsights
        locale={locale}
        translations={{
          title: t("marketInsights.title"),
          listings: t("marketInsights.listings"),
          medianPrice: t("marketInsights.medianPrice"),
          priceRange: t("marketInsights.priceRange"),
          viewCategory: t("marketInsights.viewCategory"),
          poweredBy: t("marketInsights.poweredBy"),
          noData: t("marketInsights.noData"),
        }}
      />

      {/* How it works */}
      <section className="bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            {t("howItWorks.title")}
          </h2>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { step: "step1", icon: Search, color: "text-blue-500" },
              { step: "step2", icon: Bot, color: "text-purple-500" },
              { step: "step3", icon: MessageSquare, color: "text-amber-500" },
              { step: "step4", icon: CheckCircle, color: "text-green-500" },
            ].map(({ step, icon: Icon, color }, i) => (
              <Card key={step} className="relative overflow-hidden">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ${color}`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>
                  <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">
                    {t(`howItWorks.${step}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`howItWorks.${step}.description`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / trust */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            <div>
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-3xl font-bold">{t("stats.aiValue")}</p>
              <p className="text-sm text-muted-foreground">
                {t("stats.aiDesc")}
              </p>
            </div>
            <div>
              <Bot className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-3xl font-bold">{t("stats.smartValue")}</p>
              <p className="text-sm text-muted-foreground">
                {t("stats.smartDesc")}
              </p>
            </div>
            <div>
              <Zap className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-3xl font-bold">{t("stats.fastValue")}</p>
              <p className="text-sm text-muted-foreground">
                {t("stats.fastDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
