/**
 * Agent Quality — Daily CRON for listing quality management
 *
 * Daily BullMQ CRON tasks:
 *   1. Find stale listings (no views 14 days) → contact sellers with improvement suggestions
 *   2. Auto-archive abandoned listings (no login + no views 30 days)
 *   3. Detect low-quality listings (no photos, short description)
 *   4. Find miscategorized listings via category name matching
 *   5. Generate quality scores and improvement recommendations
 */

import { db } from "@/server/db";

import { createNotification } from "./notification";
import { sendEmail } from "./email";
import { APP_URL, APP_NAME } from "@/lib/constants";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface QualityReport {
  staleCount: number;
  archivedCount: number;
  lowQualityCount: number;
  miscategorizedCount: number;
  contactedSellers: number;
  totalProcessed: number;
}

export interface ListingQualityScore {
  listingId: string;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

// ──────────────────────────────────────────────
// MAIN: DAILY QUALITY CHECK
// ──────────────────────────────────────────────

/** Run the full daily quality check pipeline */
export async function runDailyQualityCheck(): Promise<QualityReport> {
  console.log("[Quality Agent] Starting daily quality check...");

  const report: QualityReport = {
    staleCount: 0,
    archivedCount: 0,
    lowQualityCount: 0,
    miscategorizedCount: 0,
    contactedSellers: 0,
    totalProcessed: 0,
  };

  try {
    // 1. Handle stale listings (no views in 14 days)
    const staleResult = await handleStaleListings();
    report.staleCount = staleResult.found;
    report.contactedSellers = staleResult.contacted;

    // 2. Auto-archive abandoned listings (no login + no views 30 days)
    report.archivedCount = await archiveAbandonedListings();

    // 3. Detect and flag low-quality listings
    report.lowQualityCount = await flagLowQualityListings();

    // 4. Detect miscategorized listings
    report.miscategorizedCount = await detectMiscategorized();

    report.totalProcessed =
      report.staleCount +
      report.archivedCount +
      report.lowQualityCount +
      report.miscategorizedCount;

    // Update metrics
    await updateQualityMetrics(report);

    console.log(
      `[Quality Agent] Daily check complete: ${JSON.stringify(report)}`,
    );
  } catch (error) {
    console.error("[Quality Agent] Daily check failed:", error);
    await recordError();
  }

  return report;
}

// ──────────────────────────────────────────────
// 1. STALE LISTINGS
// ──────────────────────────────────────────────

async function handleStaleListings(): Promise<{
  found: number;
  contacted: number;
}> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Find active listings with no view increase in 14 days
  // We check updatedAt as a proxy (views would trigger updates via view-counter)
  const staleListings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      viewCount: { lt: 5 }, // very few views
      updatedAt: { lte: fourteenDaysAgo },
    },
    include: {
      images: { select: { id: true } },
      user: { select: { id: true, email: true, name: true, locale: true } },
      category: { select: { name: true, slug: true } },
    },
    take: 50, // process in batches
  });

  let contacted = 0;

  for (const listing of staleListings) {
    try {
      const suggestions = generateImprovementSuggestions(listing);

      // Send notification with suggestions
      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Boost Your Listing",
        body: `Your listing "${listing.title}" has low visibility. Here are tips to improve it: ${suggestions[0]}`,
        metadata: {
          listingId: listing.id,
          suggestions,
          viewCount: listing.viewCount,
        },
      });

      // Send email with detailed suggestions
      if (listing.user.email) {
        await sendEmail({
          to: listing.user.email,
          subject: `📈 Tips to improve your listing: "${listing.title}"`,
          html: generateImprovementEmail(listing, suggestions),
          text: `Your listing "${listing.title}" has low visibility. Suggestions: ${suggestions.join(". ")}`,
        });
        contacted++;
      }
    } catch (error) {
      console.error(
        `[Quality Agent] Failed to contact seller for listing ${listing.id}:`,
        error,
      );
    }
  }

  return { found: staleListings.length, contacted };
}

/** Generate improvement suggestions based on listing issues */
function generateImprovementSuggestions(listing: {
  title: string;
  description: string;
  images: { id: string }[];
  price: number;
}): string[] {
  const suggestions: string[] = [];

  // Image suggestions
  if (listing.images.length === 0) {
    suggestions.push("Add photos — listings with images get 5x more views");
  } else if (listing.images.length < 3) {
    suggestions.push("Add more photos — listings with 3+ images sell faster");
  }

  // Title suggestions
  if (listing.title.length < 15) {
    suggestions.push(
      "Write a more descriptive title with brand, model, and condition",
    );
  }

  // Description suggestions
  if (listing.description.length < 50) {
    suggestions.push(
      "Add a detailed description with key features and condition",
    );
  } else if (listing.description.length < 100) {
    suggestions.push(
      "Expand your description — include dimensions, age, and reason for selling",
    );
  }

  // Price suggestion
  if (listing.price > 0) {
    suggestions.push(
      "Consider enabling negotiable pricing to attract more buyers",
    );
  }

  // General tips
  if (suggestions.length === 0) {
    suggestions.push(
      "Consider a Featured Boost to increase visibility",
      "Share your listing on social media",
    );
  }

  return suggestions;
}

/** Build HTML email with improvement suggestions */
function generateImprovementEmail(
  listing: { title: string; id: string },
  suggestions: string[],
): string {
  const listItems = suggestions
    .map((s) => `<li style="margin-bottom: 8px;">${s}</li>`)
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Boost your listing visibility</h2>
      <p>Your listing <strong>"${listing.title}"</strong> hasn't been getting much attention lately. Here are some tips to improve it:</p>
      <ul style="padding-left: 20px; color: #374151;">
        ${listItems}
      </ul>
      <a href="${APP_URL}/listing/${listing.id}/edit"
         style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
        Edit Listing
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        You're receiving this because you have an active listing on ${APP_NAME}.
      </p>
    </div>
  `;
}

// ──────────────────────────────────────────────
// 2. AUTO-ARCHIVE ABANDONED LISTINGS
// ──────────────────────────────────────────────

async function archiveAbandonedListings(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find listings where:
  // - Status is ACTIVE
  // - No views + not updated in 30 days
  // - Owner hasn't logged in within 30 days
  const abandonedListings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      viewCount: { lt: 3 },
      updatedAt: { lte: thirtyDaysAgo },
      user: {
        lastLoginAt: { lte: thirtyDaysAgo },
      },
    },
    select: {
      id: true,
      title: true,
      userId: true,
      user: { select: { email: true } },
    },
    take: 100,
  });

  let archivedCount = 0;

  for (const listing of abandonedListings) {
    try {
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "EXPIRED" },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Listing Archived",
        body: `Your listing "${listing.title}" was auto-archived due to inactivity. You can reactivate it anytime.`,
        metadata: { listingId: listing.id, reason: "abandoned" },
      });

      archivedCount++;
    } catch (error) {
      console.error(
        `[Quality Agent] Failed to archive listing ${listing.id}:`,
        error,
      );
    }
  }

  return archivedCount;
}

// ──────────────────────────────────────────────
// 3. LOW-QUALITY DETECTION
// ──────────────────────────────────────────────

async function flagLowQualityListings(): Promise<number> {
  // Find recently created listings that are low-quality
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      images: { select: { id: true } },
    },
    take: 100,
  });

  let flaggedCount = 0;

  for (const listing of listings) {
    const qualityScore = calculateListingQuality(listing);

    if (qualityScore.score < 30) {
      // Create escalation
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Low quality: "${listing.title}" (score: ${qualityScore.score}/100)`,
          description: `Quality agent flagged this listing:\n\nIssues:\n${qualityScore.issues.map((i) => `• ${i}`).join("\n")}\n\nSuggestions:\n${qualityScore.suggestions.map((s) => `• ${s}`).join("\n")}`,
          metadata: {
            qualityScore: qualityScore.score,
            issues: qualityScore.issues,
          },
          status: "PENDING",
        },
      });

      // Notify user with improvement tips
      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Improve Your Listing",
        body: `Your listing "${listing.title}" needs improvement: ${qualityScore.issues[0]}`,
        metadata: {
          listingId: listing.id,
          qualityScore: qualityScore.score,
          suggestions: qualityScore.suggestions,
        },
      });

      flaggedCount++;
    }
  }

  return flaggedCount;
}

/** Calculate a quality score for a listing */
export function calculateListingQuality(listing: {
  title: string;
  description: string;
  images: { id: string }[];
  price: number;
}): ListingQualityScore {
  let score = 100;
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Image checks (30 points max)
  if (listing.images.length === 0) {
    score -= 30;
    issues.push("No photos");
    suggestions.push("Add at least 3 clear photos of your item");
  } else if (listing.images.length === 1) {
    score -= 15;
    issues.push("Only 1 photo");
    suggestions.push("Add more photos showing different angles");
  } else if (listing.images.length < 3) {
    score -= 5;
  }

  // Title checks (20 points max)
  if (listing.title.length < 5) {
    score -= 20;
    issues.push("Title too short");
    suggestions.push(
      "Write a descriptive title (include brand, model, key feature)",
    );
  } else if (listing.title.length < 15) {
    score -= 10;
    issues.push("Title could be more descriptive");
    suggestions.push("Add details like brand, size, or condition to the title");
  }

  // Description checks (30 points max)
  if (listing.description.length < 10) {
    score -= 30;
    issues.push("Description too short or missing");
    suggestions.push(
      "Write a detailed description (condition, features, measurements, why selling)",
    );
  } else if (listing.description.length < 50) {
    score -= 15;
    issues.push("Description is brief");
    suggestions.push(
      "Expand your description with more details about the item",
    );
  } else if (listing.description.length < 100) {
    score -= 5;
  }

  // Price check (20 points max)
  if (listing.price <= 0) {
    score -= 20;
    issues.push("Missing or zero price");
    suggestions.push("Set a reasonable price for your item");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    listingId: "",
    score,
    issues,
    suggestions,
  };
}

// ──────────────────────────────────────────────
// 4. MISCATEGORIZATION DETECTION
// ──────────────────────────────────────────────

async function detectMiscategorized(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch recent listings with category info
  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      title: true,
      description: true,
      userId: true,
      categoryId: true,
      category: { select: { name: true, slug: true } },
    },
    take: 100,
  });

  // Fetch all categories for matching
  const allCategories = await db.category.findMany({
    where: { parentId: { not: null } }, // leaf categories
    select: { id: true, name: true, slug: true },
  });

  let miscategorizedCount = 0;

  for (const listing of listings) {
    const currentCategoryName = getCategoryNameEn(listing.category.name);
    const suggestedCategory = findBetterCategory(
      listing.title,
      listing.description,
      currentCategoryName,
      allCategories,
    );

    if (suggestedCategory) {
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Possible miscategorization: "${listing.title}"`,
          description: `Listing appears to be in the wrong category.\n\nCurrent: ${currentCategoryName}\nSuggested: ${suggestedCategory.name}\n\nTitle: ${listing.title}`,
          metadata: {
            currentCategory: listing.categoryId,
            suggestedCategoryId: suggestedCategory.id,
            suggestedCategoryName: suggestedCategory.name,
          },
          status: "PENDING",
        },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Category Suggestion",
        body: `Your listing "${listing.title}" might fit better in "${suggestedCategory.name}". Consider updating it.`,
        metadata: {
          listingId: listing.id,
          suggestedCategoryId: suggestedCategory.id,
        },
      });

      miscategorizedCount++;
    }
  }

  return miscategorizedCount;
}

/** Extract English name from multilingual JSON */
function getCategoryNameEn(name: unknown): string {
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null) {
    return (
      (name as Record<string, string>).en ||
      Object.values(name as Record<string, string>)[0] ||
      "Unknown"
    );
  }
  return "Unknown";
}

/** Find a better category match based on listing content */
function findBetterCategory(
  title: string,
  description: string,
  currentCategoryName: string,
  allCategories: { id: string; name: unknown; slug: string }[],
): { id: string; name: string } | null {
  const text = `${title} ${description}`.toLowerCase();

  // Category keyword maps for common misplacements
  const categoryKeywords: Record<string, string[]> = {
    electronics: [
      "phone",
      "laptop",
      "computer",
      "tablet",
      "tv",
      "television",
      "camera",
      "headphones",
      "speaker",
      "monitor",
      "printer",
      "telefon",
      "dator",
      "компьютер",
      "телефон",
      "планшет",
    ],
    vehicles: [
      "car",
      "motorcycle",
      "bike",
      "scooter",
      "automobile",
      "auto",
      "automašīna",
      "motocikl",
      "автомобиль",
      "мотоцикл",
    ],
    clothing: [
      "dress",
      "shirt",
      "jacket",
      "shoes",
      "pants",
      "jeans",
      "kleita",
      "krekls",
      "apavi",
      "платье",
      "рубашка",
      "обувь",
    ],
    furniture: [
      "sofa",
      "table",
      "chair",
      "desk",
      "bed",
      "wardrobe",
      "shelf",
      "dīvāns",
      "galds",
      "krēsls",
      "диван",
      "стол",
      "кровать",
    ],
    "real-estate": [
      "apartment",
      "house",
      "flat",
      "room",
      "rent",
      "dzīvoklis",
      "māja",
      "квартира",
      "дом",
      "аренда",
    ],
  };

  const currentLower = currentCategoryName.toLowerCase();

  for (const [categorySlug, keywords] of Object.entries(categoryKeywords)) {
    // Skip if already in the right category
    if (currentLower.includes(categorySlug)) continue;

    const matchedKeywords = keywords.filter((kw) => text.includes(kw));
    // Need at least 2 keyword matches to suggest recategorization
    if (matchedKeywords.length >= 2) {
      const betterCategory = allCategories.find((c) =>
        c.slug.includes(categorySlug),
      );
      if (betterCategory) {
        return {
          id: betterCategory.id,
          name: getCategoryNameEn(betterCategory.name),
        };
      }
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateQualityMetrics(report: QualityReport): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "SELLING", date: today } },
    create: {
      agentType: "SELLING",
      date: today,
      itemsProcessed: report.totalProcessed,
    },
    update: {
      itemsProcessed: { increment: report.totalProcessed },
    },
  });
}

async function recordError(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "SELLING", date: today } },
    create: {
      agentType: "SELLING",
      date: today,
      errorsCount: 1,
    },
    update: {
      errorsCount: { increment: 1 },
    },
  });
}
