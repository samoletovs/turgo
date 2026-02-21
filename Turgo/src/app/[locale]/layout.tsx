import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LOCALES, APP_URL } from "@/lib/constants";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ConciergeChat } from "@/components/concierge-chat";
import { Providers } from "@/components/providers";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { SkipToContent } from "@/components/a11y";
import { ErrorBoundary } from "@/components/error-boundary";
import { JsonLd } from "@/components/json-ld";
import { websiteJsonLd, organizationJsonLd, generatePageMetadata } from "@/lib/seo";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.hero" });
  return {
    ...generatePageMetadata({
      title: t("title"),
      description: t("subtitle"),
      locale,
    }),
    manifest: "/manifest.json",
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "default",
      "apple-mobile-web-app-title": "Turgo",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const session = await auth();
  const a11yMessages = messages as Record<string, Record<string, string>>;
  const skipLabel = a11yMessages?.a11y?.skipToContent || "Skip to main content";

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Providers>
        <SkipToContent label={skipLabel} />

        {/* Hreflang alternate links for SEO */}
        {LOCALES.map((loc) => (
          <link
            key={loc}
            rel="alternate"
            hrefLang={loc}
            href={`${APP_URL}/${loc}`}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href={`${APP_URL}/en`} />

        {/* JSON-LD structured data */}
        <JsonLd data={websiteJsonLd(locale)} />
        <JsonLd data={organizationJsonLd()} />

        <div className="flex min-h-screen flex-col">
          <Navbar
            locale={locale}
            user={session?.user ? { name: session.user.name || "", avatar: session.user.image || undefined } : null}
          />
          <main id="main-content" className="flex-1" role="main">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Footer locale={locale} />
        </div>
        <ConciergeChat locale={locale} />
        <CookieConsentBanner />
      </Providers>
    </NextIntlClientProvider>
  );
}
