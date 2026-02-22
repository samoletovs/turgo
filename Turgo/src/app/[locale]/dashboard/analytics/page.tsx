import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { generatePageMetadata } from "@/lib/seo";
import { AnalyticsClient } from "./analytics-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  return generatePageMetadata({
    title: t("title"),
    description: t("subtitle"),
    path: "/dashboard/analytics",
    locale,
  });
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/signin`);

  // Check subscription — Pro/Business only
  const subscription = await db.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { plan: true },
  });

  const planName = subscription?.plan?.name ?? "FREE";
  if (planName === "FREE") {
    redirect(`/${locale}/pricing`);
  }

  return <AnalyticsClient locale={locale} />;
}
