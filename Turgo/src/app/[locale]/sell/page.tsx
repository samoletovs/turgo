import { useTranslations } from "next-intl";
import { SellingAgentWizard } from "@/components/selling-agent-wizard";
import { db } from "@/server/db";
import { AlertTriangle, FileEdit, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch categories + locations for the wizard
  let categories: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[] = [];
  let locations: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[] = [];
  let dbError = false;

  try {
    const [cats, locs] = await Promise.all([
      db.category.findMany({
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          children: {
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
            select: {
              id: true,
              name: true,
              slug: true,
              children: {
                orderBy: { name: "asc" },
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
    console.error("Failed to load sell page data:", e);
    dbError = true;
  }

  if (dbError) {
    return <SellPageError locale={locale} />;
  }

  return <SellPageClient locale={locale} categories={categories} locations={locations} />;
}

function SellPageError({ locale: _locale }: { locale: string }) {
  const t = useTranslations("sell");
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-md px-4 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground">
          Service is temporarily unavailable. Please try again later.
        </p>
      </div>
    </div>
  );
}

function SellPageClient({
  locale,
  categories,
  locations,
}: {
  locale: string;
  categories: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[];
  locations: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[];
}) {
  const t = useTranslations("sell");

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <SellingAgentWizard
          locale={locale}
          categories={categories}
          locations={locations}
        />

        {/* Manual listing fallback link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Prefer to do it yourself?{" "}
            <Link
              href={`/${locale}/listing/new`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Create listing manually
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
