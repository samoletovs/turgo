import { useTranslations } from "next-intl";
import { SellingAgentWizard } from "@/components/selling-agent-wizard";
import { db } from "@/server/db";

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch categories + locations for the wizard
  const [categories, locations] = await Promise.all([
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <SellPageClient locale={locale} categories={categories as any} locations={locations as any} />;
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
      </div>
    </div>
  );
}
