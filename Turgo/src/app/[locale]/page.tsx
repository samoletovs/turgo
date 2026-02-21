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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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
  { name: "Transport", slug: "transport" },
  { name: "Real Estate", slug: "real-estate" },
  { name: "Electronics", slug: "electronics" },
  { name: "Home & Garden", slug: "home-garden" },
  { name: "Fashion", slug: "fashion" },
  { name: "Jobs", slug: "jobs" },
  { name: "Services", slug: "services" },
  { name: "Kids & Baby", slug: "kids-baby" },
  { name: "Sports & Outdoors", slug: "sports-outdoors" },
  { name: "Pets", slug: "pets" },
  { name: "Hobbies & Leisure", slug: "hobbies-leisure" },
  { name: "Agriculture", slug: "agriculture" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <>
      {/* Hero section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>

          {/* Search bar */}
          <form
            className="mx-auto mt-8 flex max-w-xl gap-2"
            action={`/${locale}/search`}
            method="GET"
            suppressHydrationWarning
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder={t("hero.searchPlaceholder")}
                className="h-12 pl-10 text-base rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" className="rounded-xl">
              {tCommon("search")}
            </Button>
          </form>

          {/* CTA */}
          <div className="mt-6">
            <Button asChild size="lg" variant="default" className="gap-2 rounded-xl">
              <Link href="/sell">
                <Bot className="h-5 w-5" />
                {t("hero.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories grid */}
      <section className="py-12">
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
                  <span className="text-sm font-medium text-center">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            {t("howItWorks.title")}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "step1", icon: Search, color: "text-blue-500" },
              { step: "step2", icon: Bot, color: "text-purple-500" },
              { step: "step3", icon: Zap, color: "text-green-500" },
            ].map(({ step, icon: Icon, color }, i) => (
              <Card key={step} className="relative overflow-hidden">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ${color}`}>
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
              <p className="text-3xl font-bold">24/7</p>
              <p className="text-sm text-muted-foreground">AI agents working for you</p>
            </div>
            <div>
              <Bot className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-3xl font-bold">Smart</p>
              <p className="text-sm text-muted-foreground">Dynamic pricing optimization</p>
            </div>
            <div>
              <Zap className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-3xl font-bold">Fast</p>
              <p className="text-sm text-muted-foreground">Auto-respond to buyers instantly</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
