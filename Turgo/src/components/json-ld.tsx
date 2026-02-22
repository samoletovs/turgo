import {
  jsonLdString,
  listingJsonLd,
  organizationJsonLd,
  breadcrumbJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { APP_URL } from "@/lib/constants";

/** Render JSON-LD structured data as a script tag */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}

/** Product (listing) JSON-LD for listing detail pages */
export function ListingJsonLd({
  name,
  description,
  price,
  currency,
  image,
  url,
  condition,
  seller,
  datePosted,
  category,
  sku,
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
  category?: string;
  sku?: string;
}) {
  const data = listingJsonLd({
    name,
    description,
    price,
    currency,
    image,
    url,
    condition,
    seller,
    datePosted,
  });

  // Extend with optional category + sku
  if (category) (data as Record<string, unknown>).category = category;
  if (sku) (data as Record<string, unknown>).sku = sku;

  return <JsonLd data={data as Record<string, unknown>} />;
}

/** Organization JSON-LD (rendered once in layout) */
export function OrganizationJsonLd() {
  return <JsonLd data={organizationJsonLd() as Record<string, unknown>} />;
}

/** BreadcrumbList JSON-LD for category / listing breadcrumbs */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return <JsonLd data={breadcrumbJsonLd(items) as Record<string, unknown>} />;
}

/** SearchAction JSON-LD for sitelinks search box */
export function SearchActionJsonLd({ locale }: { locale: string }) {
  return <JsonLd data={websiteJsonLd(locale) as Record<string, unknown>} />;
}

/** FAQ JSON-LD for help / FAQ pages */
export function FaqJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
  return <JsonLd data={data} />;
}

/** ContactPage JSON-LD */
export function ContactPageJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Turgo",
    url: `${APP_URL}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: "Turgo",
      email: "support@turgo.io",
      url: APP_URL,
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@turgo.io",
        contactType: "customer service",
        availableLanguage: [
          "English",
          "Latvian",
          "Russian",
          "Lithuanian",
          "Estonian",
        ],
      },
    },
  };
  return <JsonLd data={data} />;
}

/** AboutPage JSON-LD */
export function AboutPageJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Turgo",
    url: `${APP_URL}/about`,
    mainEntity: organizationJsonLd(),
  };
  return <JsonLd data={data} />;
}
