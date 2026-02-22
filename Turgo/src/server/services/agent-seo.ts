/**
 * Agent SEO — Automated search engine optimization
 *
 * Features:
 *   1. Auto-generate meta titles/descriptions for listings and categories
 *   2. Generate XML sitemap
 *   3. Add JSON-LD structured data for listings
 *   4. Monitor hreflang for all 5 languages
 *   5. Category page SEO metadata generation
 */

import { db } from "@/server/db";
import { aiComplete, createMessages } from "./ai";
import { listingJsonLd, breadcrumbJsonLd, generateHrefLangs } from "@/lib/seo";
import { APP_URL, APP_NAME, LOCALES } from "@/lib/constants";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string[];
  jsonLd: Record<string, unknown>;
}

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
  alternates?: { hreflang: string; href: string }[];
}

export interface SeoReport {
  listingsOptimized: number;
  categoriesOptimized: number;
  sitemapEntries: number;
  hreflangIssues: number;
}

// ──────────────────────────────────────────────
// 1. LISTING SEO METADATA
// ──────────────────────────────────────────────

/** Generate optimized SEO metadata for a listing */
export async function generateListingSeo(
  listingId: string,
): Promise<SeoMetadata | null> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      category: { select: { name: true, slug: true } },
      images: { select: { url: true, alt: true }, take: 1 },
      user: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  if (!listing) return null;

  const categoryName = extractName(listing.category.name);
  const locationName = listing.location
    ? extractName(listing.location.name)
    : null;

  // Try AI-powered meta generation
  try {
    const result = await aiComplete({
      messages: createMessages(
        `You are an SEO specialist for a classifieds marketplace. Generate optimized meta title and description.
Rules:
- Title: max 60 characters, include key item details and location
- Description: max 155 characters, include price, condition, key features
- Keywords: 5-8 relevant search terms
Respond in JSON: { "title": "...", "description": "...", "keywords": ["..."] }`,
        `Listing: "${listing.title}"
Description: "${listing.description.slice(0, 300)}"
Price: €${listing.price}
Condition: ${listing.condition}
Category: ${categoryName}
${locationName ? `Location: ${locationName}` : ""}`,
      ),
      temperature: 0.3,
      maxTokens: 300,
    });

    const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const jsonLd = listingJsonLd({
      name: listing.title,
      description: listing.description.slice(0, 200),
      price: listing.price,
      currency: listing.currency,
      image: listing.images[0]?.url,
      url: `${APP_URL}/listing/${listing.slug}`,
      condition: listing.condition,
      seller: listing.user.name ? { name: listing.user.name } : undefined,
      datePosted: listing.createdAt.toISOString(),
    });

    return {
      title: truncate(parsed.title || listing.title, 60),
      description: truncate(parsed.description || listing.description, 155),
      keywords: parsed.keywords || [],
      jsonLd,
    };
  } catch {
    // Fallback to rule-based meta generation
    return generateListingSeoFallback(listing, categoryName, locationName);
  }
}

/** Rule-based fallback for listing SEO */
function generateListingSeoFallback(
  listing: {
    title: string;
    description: string;
    price: number;
    currency: string;
    condition: string;
    slug: string;
    images: { url: string; alt: string | null }[];
    user: { name: string | null };
    createdAt: Date;
  },
  categoryName: string,
  locationName: string | null,
): SeoMetadata {
  const priceStr = `€${listing.price.toFixed(0)}`;
  const location = locationName ? ` in ${locationName}` : "";

  const title = truncate(
    `${listing.title} — ${priceStr}${location} | ${APP_NAME}`,
    60,
  );

  const description = truncate(
    `${listing.condition} ${listing.title} for ${priceStr}${location}. ${listing.description}`,
    155,
  );

  const keywords = [
    listing.title.toLowerCase(),
    categoryName.toLowerCase(),
    listing.condition.toLowerCase(),
    locationName?.toLowerCase(),
    "buy",
    "classifieds",
    "baltic",
  ].filter(Boolean) as string[];

  const jsonLd = listingJsonLd({
    name: listing.title,
    description: listing.description.slice(0, 200),
    price: listing.price,
    currency: listing.currency,
    image: listing.images[0]?.url,
    url: `${APP_URL}/listing/${listing.slug}`,
    condition: listing.condition,
    seller: listing.user.name ? { name: listing.user.name } : undefined,
    datePosted: listing.createdAt.toISOString(),
  });

  return { title, description, keywords, jsonLd };
}

// ──────────────────────────────────────────────
// 2. CATEGORY SEO METADATA
// ──────────────────────────────────────────────

/** Generate SEO metadata for a category page */
export async function generateCategorySeo(
  categoryId: string,
  locale: string = "en",
): Promise<SeoMetadata | null> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    include: {
      parent: { select: { name: true, slug: true } },
      _count: { select: { listings: true } },
    },
  });

  if (!category) return null;

  const name = extractNameByLocale(category.name, locale);
  const parentName = category.parent
    ? extractNameByLocale(category.parent.name, locale)
    : null;
  const listingCount = category._count.listings;

  const title = truncate(
    parentName
      ? `${name} — ${parentName} | ${APP_NAME}`
      : `${name} | ${APP_NAME}`,
    60,
  );

  const description = truncate(
    `Browse ${listingCount} ${name.toLowerCase()} listings${parentName ? ` in ${parentName}` : ""} on ${APP_NAME}. Find the best deals in the Baltic region.`,
    155,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: `${APP_URL}/${locale}/category/${category.slug}`,
    numberOfItems: listingCount,
    isPartOf: {
      "@type": "WebSite",
      name: APP_NAME,
      url: APP_URL,
    },
    breadcrumb: breadcrumbJsonLd([
      { name: APP_NAME, url: `${APP_URL}/${locale}` },
      ...(parentName
        ? [
            {
              name: parentName,
              url: `${APP_URL}/${locale}/category/${category.parent!.slug}`,
            },
          ]
        : []),
      {
        name,
        url: `${APP_URL}/${locale}/category/${category.slug}`,
      },
    ]),
  };

  return {
    title,
    description,
    keywords: [
      name.toLowerCase(),
      parentName?.toLowerCase(),
      "classifieds",
      "baltic",
      locale,
    ].filter(Boolean) as string[],
    jsonLd,
  };
}

// ──────────────────────────────────────────────
// 3. XML SITEMAP GENERATION
// ──────────────────────────────────────────────

/** Generate the full XML sitemap as a string */
export async function generateSitemap(): Promise<string> {
  const entries: SitemapEntry[] = [];

  // Static pages — all locales
  const staticPages = [
    { path: "", priority: 1.0, changefreq: "daily" as const },
    { path: "/about", priority: 0.5, changefreq: "monthly" as const },
    { path: "/search", priority: 0.8, changefreq: "daily" as const },
    { path: "/pricing", priority: 0.5, changefreq: "monthly" as const },
    { path: "/help", priority: 0.4, changefreq: "monthly" as const },
    { path: "/contact", priority: 0.3, changefreq: "monthly" as const },
    { path: "/privacy", priority: 0.2, changefreq: "yearly" as const },
    { path: "/terms", priority: 0.2, changefreq: "yearly" as const },
  ];

  for (const page of staticPages) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${APP_URL}/${locale}${page.path}`,
        lastmod: new Date().toISOString().split("T")[0],
        changefreq: page.changefreq,
        priority: page.priority,
        alternates: generateHrefLangs(page.path),
      });
    }
  }

  // Category pages
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  for (const cat of categories) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${APP_URL}/${locale}/category/${cat.slug}`,
        lastmod: new Date().toISOString().split("T")[0],
        changefreq: "daily",
        priority: 0.7,
        alternates: generateHrefLangs(`/category/${cat.slug}`),
      });
    }
  }

  // Active listings (most recent 5000)
  const listings = await db.listing.findMany({
    where: { status: "ACTIVE" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  for (const listing of listings) {
    entries.push({
      url: `${APP_URL}/listing/${listing.slug}`,
      lastmod: listing.updatedAt.toISOString().split("T")[0],
      changefreq: "weekly",
      priority: 0.6,
    });
  }

  // Build XML
  return buildSitemapXml(entries);
}

/** Build sitemap XML string from entries */
function buildSitemapXml(entries: SitemapEntry[]): string {
  const xmlEntries = entries
    .map((entry) => {
      let xml = `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>`;

      if (entry.alternates) {
        for (const alt of entry.alternates) {
          xml += `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}" />`;
        }
      }

      xml += "\n  </url>";
      return xml;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${xmlEntries}
</urlset>`;
}

// ──────────────────────────────────────────────
// 4. HREFLANG MONITORING
// ──────────────────────────────────────────────

/** Audit hreflang tags across the site for issues */
export async function auditHreflang(): Promise<{
  issues: string[];
  pagesChecked: number;
}> {
  const issues: string[] = [];
  let pagesChecked = 0;

  // Check that all categories have all 5 locale versions
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
  });

  for (const cat of categories) {
    pagesChecked++;
    const name = cat.name as Record<string, string>;

    for (const locale of LOCALES) {
      if (!name[locale] || name[locale].trim() === "") {
        issues.push(`Category "${cat.slug}" missing ${locale} translation`);
      }
    }

    // Verify hreflang links would be valid
    const hreflangs = generateHrefLangs(`/category/${cat.slug}`);
    if (hreflangs.length !== LOCALES.length) {
      issues.push(
        `Category "${cat.slug}" has ${hreflangs.length}/${LOCALES.length} hreflang entries`,
      );
    }
  }

  // Check locations have all locale translations
  const locations = await db.location.findMany({
    select: { slug: true, name: true },
    take: 100,
  });

  for (const loc of locations) {
    pagesChecked++;
    const name = loc.name as Record<string, string>;

    for (const locale of LOCALES) {
      if (!name[locale] || name[locale].trim() === "") {
        issues.push(`Location "${loc.slug}" missing ${locale} translation`);
      }
    }
  }

  return { issues, pagesChecked };
}

// ──────────────────────────────────────────────
// 5. BULK SEO OPTIMIZATION
// ──────────────────────────────────────────────

/** Run SEO optimization across all listings/categories */
export async function runSeoOptimization(): Promise<SeoReport> {
  const report: SeoReport = {
    listingsOptimized: 0,
    categoriesOptimized: 0,
    sitemapEntries: 0,
    hreflangIssues: 0,
  };

  try {
    // Optimize recent listings without SEO metadata
    const listings = await db.listing.findMany({
      where: {
        status: "ACTIVE",
        // Focus on listings that might not have good SEO
        OR: [
          { description: { endsWith: "" } }, // all — process a batch
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const listing of listings) {
      const seo = await generateListingSeo(listing.id);
      if (seo) report.listingsOptimized++;
    }

    // Optimize categories
    const categories = await db.category.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const category of categories) {
      const seo = await generateCategorySeo(category.id);
      if (seo) report.categoriesOptimized++;
    }

    // Generate sitemap
    const sitemap = await generateSitemap();
    report.sitemapEntries = (sitemap.match(/<url>/g) || []).length;

    // Audit hreflang
    const hreflangAudit = await auditHreflang();
    report.hreflangIssues = hreflangAudit.issues.length;

    // Update metrics
    await updateSeoMetrics(report);
  } catch (error) {
    console.error("[SEO Agent] Optimization failed:", error);
  }

  return report;
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function extractName(name: unknown): string {
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null) {
    const obj = name as Record<string, string>;
    return obj.en || Object.values(obj)[0] || "Unknown";
  }
  return "Unknown";
}

function extractNameByLocale(name: unknown, locale: string): string {
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null) {
    const obj = name as Record<string, string>;
    return obj[locale] || obj.en || Object.values(obj)[0] || "Unknown";
  }
  return "Unknown";
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateSeoMetrics(report: SeoReport): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "SELLING", date: today } },
    create: {
      agentType: "SELLING",
      date: today,
      itemsProcessed: report.listingsOptimized + report.categoriesOptimized,
    },
    update: {
      itemsProcessed: {
        increment: report.listingsOptimized + report.categoriesOptimized,
      },
    },
  });
}
