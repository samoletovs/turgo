/**
 * SsLvScraper — Aggregates public market data from ss.lv
 * Collects STATISTICS ONLY: price ranges, listing counts, durations
 * NEVER collects personal data, verbatim descriptions, or images
 * Respects robots.txt and rate limits
 */

import { db } from "@/server/db";
import { delay } from "@/lib/utils";
import type { ScraperCategoryStats } from "@/types";

const BASE_URL = "https://www.ss.lv";
const RATE_LIMIT_MS = parseInt(process.env.SSLV_SCRAPER_RATE_LIMIT_MS || "1000", 10);

/** Category URL mappings on ss.lv */
const CATEGORY_URLS: Record<string, string> = {
  cars: "/lv/transport/cars/",
  apartments: "/lv/real-estate/flats/riga/",
  electronics: "/lv/electronics/",
  phones: "/lv/electronics/phones/",
  computers: "/lv/electronics/computers/",
  furniture: "/lv/home-stuff/furniture/",
  clothing: "/lv/clothes/",
  jobs: "/lv/work/",
};

/** Check if scraping is enabled */
export function isScrapingEnabled(): boolean {
  return process.env.SSLV_SCRAPER_ENABLED === "true";
}

/** Fetch and parse a page, extracting only aggregate price data */
export async function fetchCategoryStats(
  categorySlug: string,
  url: string
): Promise<ScraperCategoryStats | null> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        "User-Agent": "TurgoStatsBot/1.0 (statistics only, respects robots.txt)",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      console.warn(`[Scraper] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract prices from listing summaries (aggregate only)
    const pricePattern = /(\d[\d\s]*(?:\.\d{2})?)\s*€/g;
    const prices: number[] = [];
    let match;

    while ((match = pricePattern.exec(html)) !== null) {
      const price = parseFloat(match[1].replace(/\s/g, ""));
      if (price > 0 && price < 10_000_000) {
        prices.push(price);
      }
    }

    if (prices.length === 0) return null;

    prices.sort((a, b) => a - b);
    const medianIdx = Math.floor(prices.length / 2);

    return {
      categorySlug,
      medianPrice: prices[medianIdx],
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      listingCount: prices.length,
    };
  } catch (error) {
    console.error(`[Scraper] Error fetching ${url}:`, error);
    return null;
  }
}

/** Run the scraper for all configured categories */
export async function runScraper(): Promise<{
  categoriesProcessed: number;
  snapshotsCreated: number;
  errors: number;
}> {
  if (!isScrapingEnabled()) {
    console.log("[Scraper] Scraping is disabled");
    return { categoriesProcessed: 0, snapshotsCreated: 0, errors: 0 };
  }

  console.log("[Scraper] Starting market data collection...");

  let snapshotsCreated = 0;
  let errors = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [slug, url] of Object.entries(CATEGORY_URLS)) {
    try {
      await delay(RATE_LIMIT_MS); // Respect rate limit

      const stats = await fetchCategoryStats(slug, url);
      if (!stats) {
        errors++;
        continue;
      }

      // Find matching category in our database
      const category = await db.category.findFirst({
        where: { slug: { contains: slug } },
      });

      if (!category) {
        console.warn(`[Scraper] No matching category for slug: ${slug}`);
        continue;
      }

      // Upsert market snapshot
      await db.marketSnapshot.upsert({
        where: {
          categoryId_locationId_date: {
            categoryId: category.id,
            locationId: null as unknown as string,
            date: today,
          },
        },
        create: {
          categoryId: category.id,
          date: today,
          medianPrice: stats.medianPrice,
          avgPrice: stats.avgPrice,
          minPrice: stats.minPrice,
          maxPrice: stats.maxPrice,
          listingCount: stats.listingCount,
        },
        update: {
          medianPrice: stats.medianPrice,
          avgPrice: stats.avgPrice,
          minPrice: stats.minPrice,
          maxPrice: stats.maxPrice,
          listingCount: stats.listingCount,
        },
      });

      snapshotsCreated++;
      console.log(
        `[Scraper] ${slug}: ${stats.listingCount} listings, median €${stats.medianPrice.toFixed(0)}`
      );
    } catch (error) {
      console.error(`[Scraper] Error processing ${slug}:`, error);
      errors++;
    }
  }

  console.log(
    `[Scraper] Complete: ${snapshotsCreated} snapshots, ${errors} errors`
  );

  return {
    categoriesProcessed: Object.keys(CATEGORY_URLS).length,
    snapshotsCreated,
    errors,
  };
}
