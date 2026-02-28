/**
 * SsLvScraper — Aggregates public market data from ss.lv
 * Collects STATISTICS ONLY: price ranges, listing counts, durations
 * NEVER collects personal data, verbatim descriptions, or images
 * Respects robots.txt and rate limits (SSLV_SCRAPER_RATE_LIMIT_MS)
 *
 * Feature flag: SSLV_SCRAPER_ENABLED — disable once own data is sufficient
 * CRON schedule: SSLV_SCRAPER_CRON (default: 0 3 * * *)
 */

import { db } from "@/server/db";
import { delay } from "@/lib/utils";
import type { ScraperCategoryStats } from "@/types";

const BASE_URL = "https://www.ss.lv";
const RATE_LIMIT_MS = parseInt(
  process.env.SSLV_SCRAPER_RATE_LIMIT_MS || "1000",
  10,
);
const USER_AGENT =
  "TurgoStatsBot/1.0 (aggregated statistics only; respects robots.txt)";

// ──────────────────────────────────────────────
// CATEGORY + REGION URL MAPPINGS
// ──────────────────────────────────────────────

/** Category URL mappings on ss.lv (organized by region + subcategories) */
const CATEGORY_URLS: Record<
  string,
  {
    path: string;
    regions?: Record<string, string>;
    subcategories?: Record<string, string>;
  }
> = {
  cars: {
    path: "/lv/transport/cars/",
    regions: {
      riga: "/lv/transport/cars/riga/",
      "riga-region": "/lv/transport/cars/riga-region/",
      liepaja: "/lv/transport/cars/liepaja-and-reg/",
      daugavpils: "/lv/transport/cars/daugavpils-and-reg/",
    },
    subcategories: {
      bmw: "/lv/transport/cars/bmw/",
      audi: "/lv/transport/cars/audi/",
      volkswagen: "/lv/transport/cars/volkswagen/",
      mercedes: "/lv/transport/cars/mercedes/",
      toyota: "/lv/transport/cars/toyota/",
      volvo: "/lv/transport/cars/volvo/",
      ford: "/lv/transport/cars/ford/",
      opel: "/lv/transport/cars/opel/",
      honda: "/lv/transport/cars/honda/",
      mazda: "/lv/transport/cars/mazda/",
    },
  },
  "apartments-sale": {
    path: "/lv/real-estate/flats/riga/sell/",
    regions: {
      riga: "/lv/real-estate/flats/riga/sell/",
      jurmala: "/lv/real-estate/flats/jurmala/sell/",
      "riga-region": "/lv/real-estate/flats/riga-region/sell/",
    },
    subcategories: {
      "1-room": "/lv/real-estate/flats/riga/sell/1-room/",
      "2-rooms": "/lv/real-estate/flats/riga/sell/2-rooms/",
      "3-rooms": "/lv/real-estate/flats/riga/sell/3-rooms/",
      "4-rooms": "/lv/real-estate/flats/riga/sell/4-rooms/",
    },
  },
  "apartments-rent": {
    path: "/lv/real-estate/flats/riga/hand_over/",
    regions: {
      riga: "/lv/real-estate/flats/riga/hand_over/",
      jurmala: "/lv/real-estate/flats/jurmala/hand_over/",
    },
    subcategories: {
      "1-room": "/lv/real-estate/flats/riga/hand_over/1-room/",
      "2-rooms": "/lv/real-estate/flats/riga/hand_over/2-rooms/",
      "3-rooms": "/lv/real-estate/flats/riga/hand_over/3-rooms/",
    },
  },
  "houses-sale": {
    path: "/lv/real-estate/homes-summer-residences/riga/",
  },
  electronics: {
    path: "/lv/electronics/",
    subcategories: {
      "tv-video": "/lv/electronics/tv-video/",
      audio: "/lv/electronics/audio/",
      photo: "/lv/electronics/photo/",
      gaming: "/lv/electronics/gaming/",
    },
  },
  "phones-tablets": {
    path: "/lv/electronics/phones/",
    subcategories: {
      iphone: "/lv/electronics/phones/apple/",
      samsung: "/lv/electronics/phones/samsung/",
      xiaomi: "/lv/electronics/phones/xiaomi/",
    },
  },
  computers: {
    path: "/lv/electronics/computers/",
  },
  laptops: {
    path: "/lv/electronics/pc-portable/",
  },
  furniture: {
    path: "/lv/home-stuff/furniture/",
    subcategories: {
      sofas: "/lv/home-stuff/furniture/soft-furniture/",
      tables: "/lv/home-stuff/furniture/tables/",
      beds: "/lv/home-stuff/furniture/beds/",
      wardrobes: "/lv/home-stuff/furniture/cupboard/",
    },
  },
  "womens-clothing": {
    path: "/lv/clothes/women/",
  },
  "mens-clothing": {
    path: "/lv/clothes/men/",
  },
  bicycles: {
    path: "/lv/transport/bicycles/",
  },
  "gym-equipment": {
    path: "/lv/sport/gym-equipment/",
  },
  dogs: {
    path: "/lv/animals/dogs/",
  },
};

// ──────────────────────────────────────────────
// ROBOTS.TXT COMPLIANCE
// ──────────────────────────────────────────────

let robotsTxtCache: { content: string; fetchedAt: number } | null = null;
const ROBOTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Fetch and cache robots.txt */
async function fetchRobotsTxt(): Promise<string> {
  if (
    robotsTxtCache &&
    Date.now() - robotsTxtCache.fetchedAt < ROBOTS_CACHE_TTL
  ) {
    return robotsTxtCache.content;
  }

  try {
    const response = await fetch(`${BASE_URL}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
    });
    const content = response.ok ? await response.text() : "";
    robotsTxtCache = { content, fetchedAt: Date.now() };
    return content;
  } catch {
    return "";
  }
}

/** Check if a path is allowed by robots.txt */
async function isPathAllowed(path: string): Promise<boolean> {
  const robotsTxt = await fetchRobotsTxt();
  if (!robotsTxt) return true; // If we can't fetch robots.txt, proceed cautiously

  const lines = robotsTxt.split("\n");
  let inOurSection = false;
  let inWildcard = false;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    if (trimmed.startsWith("user-agent:")) {
      const agent = trimmed.replace("user-agent:", "").trim();
      inOurSection = agent === "turgostatsbot" || agent === "turgo";
      inWildcard = agent === "*";
    }

    if ((inOurSection || inWildcard) && trimmed.startsWith("disallow:")) {
      const disallowed = trimmed.replace("disallow:", "").trim();
      if (disallowed && path.startsWith(disallowed)) {
        return false;
      }
    }
  }

  return true;
}

// ──────────────────────────────────────────────
// SCRAPER CORE
// ──────────────────────────────────────────────

/** Check if scraping is enabled */
export function isScrapingEnabled(): boolean {
  return process.env.SSLV_SCRAPER_ENABLED === "true";
}

/** Fetch and parse a page, extracting only aggregate price data */
export async function fetchCategoryStats(
  categorySlug: string,
  url: string,
  subcategorySlug?: string,
): Promise<ScraperCategoryStats | null> {
  // Respect robots.txt
  const allowed = await isPathAllowed(url);
  if (!allowed) {
    console.warn(`[Scraper] Path disallowed by robots.txt: ${url}`);
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "lv,en;q=0.5",
      },
    });

    if (!response.ok) {
      console.warn(`[Scraper] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // ── Extract prices (aggregate only) ──
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

    // ── Extract listing dates for avg duration ──
    // ss.lv shows dates like "dd.mm.yyyy" — extract and compute average age
    const datePattern = /(\d{2})\.(\d{2})\.(\d{4})/g;
    const postDates: Date[] = [];
    let dateMatch;

    while ((dateMatch = datePattern.exec(html)) !== null) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const year = parseInt(dateMatch[3], 10);
      const date = new Date(year, month, day);
      // Only count dates within the last year (filter out unrelated dates)
      const ageMs = Date.now() - date.getTime();
      if (ageMs > 0 && ageMs < 365 * 24 * 60 * 60 * 1000) {
        postDates.push(date);
      }
    }

    let avgDaysToSell: number | undefined;
    if (postDates.length > 0) {
      const totalDays = postDates.reduce(
        (sum, d) => sum + (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
        0,
      );
      avgDaysToSell = Math.round(totalDays / postDates.length);
    }

    // ── Derive location slug from URL if applicable ──
    let locationSlug: string | undefined;
    const regionMatch = url.match(
      /\/(riga|jurmala|liepaja|daugavpils|riga-region)\//,
    );
    if (regionMatch) {
      locationSlug = regionMatch[1];
    }

    return {
      categorySlug,
      locationSlug,
      subcategorySlug,
      medianPrice: prices[medianIdx],
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      priceSpread: prices[prices.length - 1] - prices[0],
      listingCount: prices.length,
      avgDaysToSell,
    };
  } catch (error) {
    console.error(`[Scraper] Error fetching ${url}:`, error);
    return null;
  }
}

// ──────────────────────────────────────────────
// MAIN SCRAPER RUN
// ──────────────────────────────────────────────

export interface ScraperRunResult {
  categoriesProcessed: number;
  snapshotsCreated: number;
  errors: number;
  regionSnapshots: number;
  subcategorySnapshots: number;
}

/** Run the scraper for all configured categories + regions + subcategories */
export async function runScraper(): Promise<ScraperRunResult> {
  if (!isScrapingEnabled()) {
    console.log(
      "[Scraper] Scraping is disabled (SSLV_SCRAPER_ENABLED != true)",
    );
    return {
      categoriesProcessed: 0,
      snapshotsCreated: 0,
      errors: 0,
      regionSnapshots: 0,
      subcategorySnapshots: 0,
    };
  }

  console.log("[Scraper] Starting market data collection...");

  let snapshotsCreated = 0;
  let regionSnapshots = 0;
  let subcategorySnapshots = 0;
  let errors = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [slug, config] of Object.entries(CATEGORY_URLS)) {
    // ── Scrape main category page ──
    try {
      await delay(RATE_LIMIT_MS);

      const stats = await fetchCategoryStats(slug, config.path);
      if (stats) {
        await upsertSnapshot(slug, undefined, undefined, today, stats);
        snapshotsCreated++;
        console.log(
          `[Scraper] ${slug}: ${stats.listingCount} listings, median €${stats.medianPrice.toFixed(0)}${stats.avgDaysToSell ? `, avg ${stats.avgDaysToSell}d` : ""}`,
        );
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`[Scraper] Error processing ${slug}:`, error);
      errors++;
    }

    // ── Scrape region-specific pages ──
    if (config.regions) {
      for (const [regionSlug, regionUrl] of Object.entries(config.regions)) {
        try {
          await delay(RATE_LIMIT_MS);

          const stats = await fetchCategoryStats(slug, regionUrl);
          if (stats) {
            await upsertSnapshot(slug, regionSlug, undefined, today, stats);
            regionSnapshots++;
          }
        } catch (error) {
          console.error(
            `[Scraper] Error processing ${slug}/${regionSlug}:`,
            error,
          );
          errors++;
        }
      }
    }

    // ── Scrape sub-category pages ──
    if (config.subcategories) {
      for (const [subSlug, subUrl] of Object.entries(config.subcategories)) {
        try {
          await delay(RATE_LIMIT_MS);

          const stats = await fetchCategoryStats(slug, subUrl, subSlug);
          if (stats) {
            await upsertSnapshot(slug, undefined, subSlug, today, stats);
            subcategorySnapshots++;
            console.log(
              `[Scraper]   └─ ${slug}/${subSlug}: ${stats.listingCount} listings, median €${stats.medianPrice.toFixed(0)}`,
            );
          }
        } catch (error) {
          console.error(
            `[Scraper] Error processing ${slug}/${subSlug}:`,
            error,
          );
          errors++;
        }
      }
    }
  }

  console.log(
    `[Scraper] Complete: ${snapshotsCreated} category + ${regionSnapshots} region + ${subcategorySnapshots} subcategory snapshots, ${errors} errors`,
  );

  return {
    categoriesProcessed: Object.keys(CATEGORY_URLS).length,
    snapshotsCreated,
    errors,
    regionSnapshots,
    subcategorySnapshots,
  };
}

// ──────────────────────────────────────────────
// DATABASE PERSISTENCE
// ──────────────────────────────────────────────

/** Upsert a market snapshot into the database, computing demandScore from history */
async function upsertSnapshot(
  categorySlug: string,
  locationSlug: string | undefined,
  subcategorySlug: string | undefined,
  date: Date,
  stats: ScraperCategoryStats,
): Promise<void> {
  // Find matching category in our database
  const category = await db.category.findFirst({
    where: { slug: { contains: categorySlug } },
  });

  if (!category) {
    console.warn(`[Scraper] No matching category for slug: ${categorySlug}`);
    return;
  }

  // Find matching location (if region specified)
  let locationId: string | null = null;
  if (locationSlug) {
    const location = await db.location.findFirst({
      where: { slug: { contains: locationSlug } },
    });
    locationId = location?.id ?? null;
  }

  // ── Compute demandScore from previous snapshot ──
  // If listing count is dropping while prices hold/rise → high demand
  // If listing count is growing while prices drop → low demand
  let demandScore: number | null = null;
  try {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    const previousSnapshot = await db.marketSnapshot.findFirst({
      where: {
        categoryId: category.id,
        locationId: locationId ?? undefined,
        subcategorySlug: subcategorySlug ?? null,
        date: { lt: date },
      },
      orderBy: { date: "desc" },
    });

    if (
      previousSnapshot &&
      previousSnapshot.listingCount > 0 &&
      previousSnapshot.medianPrice
    ) {
      const countChange =
        (stats.listingCount - previousSnapshot.listingCount) /
        previousSnapshot.listingCount;
      const priceChange =
        (stats.medianPrice - previousSnapshot.medianPrice) /
        previousSnapshot.medianPrice;

      // demandScore: -1 (very low demand) to +1 (very high demand)
      // Decreasing supply + increasing price = high demand
      // Increasing supply + decreasing price = low demand
      demandScore = Math.max(-1, Math.min(1, priceChange - countChange));
    }
  } catch {
    // Non-critical: if we can't compute demand, leave it null
  }

  const priceSpread = stats.maxPrice - stats.minPrice;

  // Upsert market snapshot
  await db.marketSnapshot.upsert({
    where: {
      categoryId_locationId_subcategorySlug_date: {
        categoryId: category.id,
        locationId: locationId ?? "",
        subcategorySlug: subcategorySlug ?? "",
        date,
      },
    },
    create: {
      categoryId: category.id,
      locationId,
      subcategorySlug: subcategorySlug ?? null,
      date,
      medianPrice: stats.medianPrice,
      avgPrice: stats.avgPrice,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      listingCount: stats.listingCount,
      avgDaysToSell: stats.avgDaysToSell,
      demandScore,
      priceSpread,
    },
    update: {
      medianPrice: stats.medianPrice,
      avgPrice: stats.avgPrice,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      listingCount: stats.listingCount,
      avgDaysToSell: stats.avgDaysToSell,
      demandScore,
      priceSpread,
    },
  });
}

// ──────────────────────────────────────────────
// BULLMQ WORKER
// ──────────────────────────────────────────────

/** Register the scraper as a BullMQ worker (called from orchestrator init) */
export function createScraperWorker() {
  // Dynamic import to avoid circular deps with orchestrator
  // Worker is registered by agent-orchestrator.ts
  return async () => {
    console.log("[Scraper Worker] Running scheduled scraper job...");
    const result = await runScraper();
    console.log("[Scraper Worker] Result:", result);
    return result;
  };
}
