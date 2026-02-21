import { Metadata } from "next";
import { APP_NAME, APP_URL, LOCALES } from "@/lib/constants";

/** Generate hreflang alternate links for SEO */
export function generateHrefLangs(path: string) {
  const hrefLangMap: Record<string, string> = {
    en: "en",
    lv: "lv",
    ru: "ru",
    lt: "lt",
    et: "et",
  };

  return LOCALES.map((locale) => ({
    hrefLang: hrefLangMap[locale],
    href: `${APP_URL}/${locale}${path}`,
  }));
}

/** Generate standard metadata for a page */
export function generatePageMetadata({
  title,
  description,
  path = "",
  locale = "en",
  image,
  type = "website",
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  locale?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = `${APP_URL}/${locale}${path}`;
  const ogImage = image || `${APP_URL}/og-default.png`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        LOCALES.map((loc) => [loc, `${APP_URL}/${loc}${path}`])
      ),
    },
    openGraph: {
      title: `${title} | ${APP_NAME}`,
      description,
      url,
      siteName: APP_NAME,
      locale,
      type,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${APP_NAME}`,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/** JSON-LD structured data for website */
export function websiteJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: `${APP_URL}/${locale}`,
    description:
      "Agent-first classifieds platform for the Baltics. Buy and sell smarter with AI agents.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${APP_URL}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: locale,
  };
}

/** JSON-LD structured data for a listing (product) */
export function listingJsonLd({
  name,
  description,
  price,
  currency = "EUR",
  image,
  url,
  condition,
  seller,
  datePosted,
}: {
  name: string;
  description: string;
  price: number;
  currency?: string;
  image?: string;
  url: string;
  condition?: string;
  seller?: { name: string };
  datePosted?: string;
}) {
  const conditionMap: Record<string, string> = {
    NEW: "https://schema.org/NewCondition",
    USED: "https://schema.org/UsedCondition",
    REFURBISHED: "https://schema.org/RefurbishedCondition",
  };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image,
    url,
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      itemCondition: condition ? conditionMap[condition] : undefined,
      seller: seller
        ? { "@type": "Person", name: seller.name }
        : undefined,
    },
    datePosted,
  };
}

/** JSON-LD structured data for organization */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: APP_URL,
    logo: `${APP_URL}/icon-512.png`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@turgo.io",
      contactType: "customer service",
      availableLanguage: ["English", "Latvian", "Russian", "Lithuanian", "Estonian"],
    },
    areaServed: [
      { "@type": "Country", name: "Latvia" },
      { "@type": "Country", name: "Lithuania" },
      { "@type": "Country", name: "Estonia" },
    ],
  };
}

/** JSON-LD structured data for breadcrumbs */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Render JSON-LD as a raw string for use in dangerouslySetInnerHTML */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}
