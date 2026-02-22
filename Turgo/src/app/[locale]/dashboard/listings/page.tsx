import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { generatePageMetadata } from "@/lib/seo";
import { MyListingsClient } from "./listings-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myListings" });
  return generatePageMetadata({
    title: t("title"),
    description: t("subtitle"),
    path: "/dashboard/listings",
    locale,
  });
}

export default async function MyListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/signin`);

  return <MyListingsClient locale={locale} />;
}
