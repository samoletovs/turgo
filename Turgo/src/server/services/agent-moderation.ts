/**
 * Agent Moderation — Automated listing review pipeline
 *
 * BullMQ job on new listing creation. Pipeline:
 *   1. Text quality check (title + description)
 *   2. Image appropriateness (AI vision)
 *   3. Pricing anomaly (vs MarketSnapshot)
 *   4. Duplicate detection (title + description similarity)
 *   5. Scam phrase matching
 *
 * Outcomes: APPROVE (publish), FLAG (escalation queue), REJECT (notify user)
 * Stores results as EscalationItem in DB.
 */

import { db } from "@/server/db";
import { aiAnalyzeImage } from "./ai";
import { createNotification } from "./notification";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type ModerationOutcome = "APPROVE" | "FLAG" | "REJECT";

export interface ModerationResult {
  outcome: ModerationOutcome;
  score: number; // 0-100, higher = more trustworthy
  checks: ModerationCheck[];
  reasons: string[];
}

export interface ModerationCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

// ──────────────────────────────────────────────
// SCAM / SPAM PHRASE DATABASE
// ──────────────────────────────────────────────

const SCAM_PHRASES = [
  // English
  "wire transfer only",
  "western union",
  "moneygram",
  "pay upfront",
  "send money first",
  "cashier's check",
  "money order",
  "bitcoin only",
  "crypto only",
  "whatsapp me",
  "telegram me",
  "contact directly",
  "won a lottery",
  "inheritance",
  "nigerian prince",
  "overseas shipping",
  "too good to be true",
  "guaranteed profit",
  "risk free",
  // Russian
  "перевод на карту",
  "предоплата обязательна",
  "только предоплата",
  "оплата вперед",
  "гарантированный доход",
  // Latvian
  "tikai priekšapmaksa",
  "pārskaitījums uz karti",
  // Lithuanian
  "tik išankstinis mokėjimas",
  // Estonian
  "ainult ettemaks",
];

const PROHIBITED_ITEMS = [
  "weapon",
  "gun",
  "firearm",
  "ammunition",
  "drugs",
  "narcotics",
  "counterfeit",
  "fake id",
  "passport",
  "stolen",
  "ieroči",
  "šaujamierocis",
  "narkotika",
  "ginklai",
  "relv",
  "narkootikumid",
];

// ──────────────────────────────────────────────
// MAIN PIPELINE
// ──────────────────────────────────────────────

/** Run the full moderation pipeline on a listing */
export async function moderateListing(
  listingId: string,
): Promise<ModerationResult> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      images: true,
      category: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, createdAt: true, email: true } },
    },
  });

  if (!listing) {
    return {
      outcome: "REJECT",
      score: 0,
      checks: [],
      reasons: ["Listing not found"],
    };
  }

  const checks: ModerationCheck[] = [];

  // 1. Text quality check
  const textCheck = checkTextQuality(listing.title, listing.description);
  checks.push(textCheck);

  // 2. Image appropriateness
  const imageCheck = await checkImageAppropriateness(listing.images);
  checks.push(imageCheck);

  // 3. Pricing anomaly
  const pricingCheck = await checkPricingAnomaly(
    listing.price,
    listing.categoryId,
  );
  checks.push(pricingCheck);

  // 4. Duplicate detection
  const duplicateCheck = await checkDuplicates(
    listing.id,
    listing.title,
    listing.description,
    listing.userId,
  );
  checks.push(duplicateCheck);

  // 5. Scam phrase matching
  const scamCheck = checkScamPhrases(listing.title, listing.description);
  checks.push(scamCheck);

  // Calculate overall score and outcome
  const totalScore = Math.round(
    checks.reduce((sum, c) => sum + c.score, 0) / checks.length,
  );
  const failedChecks = checks.filter((c) => !c.passed);
  const reasons = failedChecks.map((c) => c.details);

  let outcome: ModerationOutcome;
  if (totalScore >= 70 && failedChecks.length === 0) {
    outcome = "APPROVE";
  } else if (totalScore < 30 || failedChecks.length >= 3) {
    outcome = "REJECT";
  } else {
    outcome = "FLAG";
  }

  // Store result and take action
  await handleModerationOutcome(listing, {
    outcome,
    score: totalScore,
    checks,
    reasons,
  });

  // Update AgentMetrics
  await updateModerationMetrics();

  return { outcome, score: totalScore, checks, reasons };
}

// ──────────────────────────────────────────────
// CHECK 1: TEXT QUALITY
// ──────────────────────────────────────────────

function checkTextQuality(title: string, description: string): ModerationCheck {
  let score = 100;
  const issues: string[] = [];

  // Title checks
  if (title.length < 5) {
    score -= 30;
    issues.push("Title too short");
  }
  if (title.length > 200) {
    score -= 10;
    issues.push("Title too long");
  }
  if (/^[A-Z\s!]+$/.test(title)) {
    score -= 15;
    issues.push("Title is ALL CAPS");
  }
  if (/(.)\1{4,}/.test(title)) {
    score -= 20;
    issues.push("Title contains repeated characters");
  }
  if (/[!]{3,}|[?]{3,}/.test(title)) {
    score -= 10;
    issues.push("Excessive punctuation in title");
  }

  // Description checks
  if (description.length < 20) {
    score -= 25;
    issues.push("Description too short");
  }
  if (description.length < 50) {
    score -= 10;
    issues.push("Description could be more detailed");
  }

  // Check for phone/email in description (should use contact fields)
  if (/\+?\d[\d\s-]{8,}/.test(description)) {
    score -= 10;
    issues.push("Phone number in description");
  }
  if (/\S+@\S+\.\S+/.test(description)) {
    score -= 10;
    issues.push("Email address in description");
  }

  // Check for URL spam
  const urlCount = (description.match(/https?:\/\//gi) || []).length;
  if (urlCount > 2) {
    score -= 20;
    issues.push(`Too many URLs in description (${urlCount})`);
  }

  score = Math.max(0, Math.min(100, score));
  return {
    name: "text-quality",
    passed: score >= 50,
    score,
    details: issues.length > 0 ? issues.join("; ") : "Text quality OK",
  };
}

// ──────────────────────────────────────────────
// CHECK 2: IMAGE APPROPRIATENESS
// ──────────────────────────────────────────────

async function checkImageAppropriateness(
  images: { url: string; id: string }[],
): Promise<ModerationCheck> {
  if (images.length === 0) {
    return {
      name: "image-check",
      passed: true, // No images is a quality issue, not moderation
      score: 60,
      details: "No images uploaded (quality concern)",
    };
  }

  let totalScore = 100;
  const issues: string[] = [];

  // Check first 3 images (to avoid excessive AI calls)
  const imagesToCheck = images.slice(0, 3);

  for (const image of imagesToCheck) {
    try {
      const result = await aiAnalyzeImage(
        image.url,
        'Analyze this image for a classifieds marketplace. Check for: inappropriate content, stock photos, screenshots of other marketplace listings, misleading images. Respond in JSON: { "appropriate": true/false, "isStockPhoto": true/false, "isScreenshot": true/false, "issues": [] }',
      );

      const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
      try {
        const analysis = JSON.parse(cleaned);
        if (!analysis.appropriate) {
          totalScore -= 40;
          issues.push(`Image flagged: ${(analysis.issues || []).join(", ")}`);
        }
        if (analysis.isStockPhoto) {
          totalScore -= 15;
          issues.push("Possible stock photo detected");
        }
        if (analysis.isScreenshot) {
          totalScore -= 10;
          issues.push("Screenshot of another listing detected");
        }
      } catch {
        // AI returned non-JSON — skip this image
      }
    } catch {
      // AI unavailable — pass by default
    }
  }

  totalScore = Math.max(0, Math.min(100, totalScore));
  return {
    name: "image-check",
    passed: totalScore >= 50,
    score: totalScore,
    details: issues.length > 0 ? issues.join("; ") : "Images OK",
  };
}

// ──────────────────────────────────────────────
// CHECK 3: PRICING ANOMALY
// ──────────────────────────────────────────────

async function checkPricingAnomaly(
  price: number,
  categoryId: string,
): Promise<ModerationCheck> {
  if (price <= 0) {
    return {
      name: "pricing-check",
      passed: false,
      score: 0,
      details: "Price is zero or negative",
    };
  }

  // Fetch recent market snapshot for the category
  const snapshot = await db.marketSnapshot.findFirst({
    where: { categoryId },
    orderBy: { date: "desc" },
  });

  if (!snapshot || !snapshot.medianPrice || !snapshot.avgPrice) {
    // No market data — can't compare, pass by default
    return {
      name: "pricing-check",
      passed: true,
      score: 80,
      details: "No market data for comparison",
    };
  }

  let score = 100;
  const issues: string[] = [];

  // Check if price is a statistical outlier
  const median = snapshot.medianPrice;
  const min = snapshot.minPrice ?? median * 0.1;
  const max = snapshot.maxPrice ?? median * 10;

  // Suspiciously low price (less than 10% of median)
  if (price < median * 0.1) {
    score -= 40;
    issues.push(
      `Price €${price} is suspiciously low (median: €${median.toFixed(0)})`,
    );
  }
  // Very low price (less than 30% of median)
  else if (price < median * 0.3) {
    score -= 20;
    issues.push(
      `Price €${price} is well below market (median: €${median.toFixed(0)})`,
    );
  }

  // Suspiciously high price (more than 5x median)
  if (price > median * 5) {
    score -= 25;
    issues.push(
      `Price €${price} is well above market (median: €${median.toFixed(0)})`,
    );
  }

  // Price outside known range
  if (price < min * 0.5 || price > max * 2) {
    score -= 15;
    issues.push("Price is outside the known market range");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    name: "pricing-check",
    passed: score >= 50,
    score,
    details:
      issues.length > 0 ? issues.join("; ") : "Price within market range",
  };
}

// ──────────────────────────────────────────────
// CHECK 4: DUPLICATE DETECTION
// ──────────────────────────────────────────────

async function checkDuplicates(
  listingId: string,
  title: string,
  description: string,
  userId: string,
): Promise<ModerationCheck> {
  let score = 100;
  const issues: string[] = [];

  // Check for exact title duplicates from the same user
  const exactDuplicates = await db.listing.findMany({
    where: {
      id: { not: listingId },
      title: { equals: title, mode: "insensitive" },
      userId,
      status: { in: ["ACTIVE", "DRAFT"] },
    },
    select: { id: true, title: true },
    take: 5,
  });

  if (exactDuplicates.length > 0) {
    score -= 40;
    issues.push(
      `Exact title duplicate from same user (${exactDuplicates.length} found)`,
    );
  }

  // Check for similar titles across all users (first 10 words)
  const titleWords = title.split(/\s+/).slice(0, 6).join(" ");
  if (titleWords.length > 10) {
    const similarListings = await db.listing.findMany({
      where: {
        id: { not: listingId },
        title: { contains: titleWords, mode: "insensitive" },
        status: "ACTIVE",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, userId: true },
      take: 10,
    });

    // Same user posting very similar listings
    const sameUserSimilar = similarListings.filter((l) => l.userId === userId);
    if (sameUserSimilar.length > 0) {
      score -= 25;
      issues.push(
        `Similar listing from same user (${sameUserSimilar.length} found)`,
      );
    }

    // Cross-user duplicates (possible reposting scam)
    const otherUserSimilar = similarListings.filter((l) => l.userId !== userId);
    if (otherUserSimilar.length > 2) {
      score -= 15;
      issues.push(`Similar listings from other users exist`);
    }
  }

  // Check description similarity (simple word overlap)
  if (description.length > 50) {
    const descWords = description
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 15)
      .join(" ");
    const descDuplicates = await db.listing.findMany({
      where: {
        id: { not: listingId },
        description: { contains: descWords, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { id: true },
      take: 3,
    });

    if (descDuplicates.length > 0) {
      score -= 20;
      issues.push(`Description matches existing listing(s)`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return {
    name: "duplicate-check",
    passed: score >= 50,
    score,
    details: issues.length > 0 ? issues.join("; ") : "No duplicates detected",
  };
}

// ──────────────────────────────────────────────
// CHECK 5: SCAM PHRASE MATCHING
// ──────────────────────────────────────────────

function checkScamPhrases(title: string, description: string): ModerationCheck {
  const text = `${title} ${description}`.toLowerCase();
  let score = 100;
  const matched: string[] = [];

  // Check scam phrases
  for (const phrase of SCAM_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      score -= 25;
      matched.push(phrase);
    }
  }

  // Check prohibited items
  for (const item of PROHIBITED_ITEMS) {
    if (text.includes(item.toLowerCase())) {
      score -= 40;
      matched.push(`[prohibited] ${item}`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return {
    name: "scam-check",
    passed: score >= 50 && matched.length === 0,
    score,
    details:
      matched.length > 0
        ? `Flagged phrases: ${matched.join(", ")}`
        : "No scam indicators found",
  };
}

// ──────────────────────────────────────────────
// OUTCOME HANDLING
// ──────────────────────────────────────────────

async function handleModerationOutcome(
  listing: {
    id: string;
    title: string;
    userId: string;
    user: { id: string };
  },
  result: ModerationResult,
): Promise<void> {
  switch (result.outcome) {
    case "APPROVE": {
      // Publish the listing
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "ACTIVE" },
      });

      // Log moderation action
      await db.moderationLog.create({
        data: {
          listingId: listing.id,
          adminId: "system",
          action: "APPROVE",
          reason: `Auto-approved (score: ${result.score}/100)`,
        },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Listing Published",
        body: `Your listing "${listing.title}" has been approved and is now live.`,
        metadata: { listingId: listing.id, moderationScore: result.score },
      });
      break;
    }

    case "FLAG": {
      // Move to moderation queue
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "MODERATION" },
      });

      // Create escalation item for admin review
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Review needed: "${listing.title}"`,
          description: `Auto-moderation flagged this listing (score: ${result.score}/100).\n\nIssues:\n${result.reasons.map((r) => `• ${r}`).join("\n")}`,
          metadata: {
            checks: result.checks.map((c) => ({
              name: c.name,
              passed: c.passed,
              score: c.score,
              details: c.details,
            })),
            overallScore: result.score,
          },
          status: "PENDING",
        },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Listing Under Review",
        body: `Your listing "${listing.title}" is being reviewed by our team. This usually takes a few hours.`,
        metadata: { listingId: listing.id },
      });
      break;
    }

    case "REJECT": {
      // Reject the listing
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "REJECTED" },
      });

      await db.moderationLog.create({
        data: {
          listingId: listing.id,
          adminId: "system",
          action: "REJECT",
          reason: `Auto-rejected (score: ${result.score}/100): ${result.reasons.join("; ")}`,
        },
      });

      // Create escalation for record-keeping
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Auto-rejected: "${listing.title}"`,
          description: `Listing auto-rejected (score: ${result.score}/100).\n\nReasons:\n${result.reasons.map((r) => `• ${r}`).join("\n")}`,
          metadata: {
            checks: result.checks.map((c) => ({
              name: c.name,
              passed: c.passed,
              score: c.score,
              details: c.details,
            })),
            overallScore: result.score,
          },
          status: "RESOLVED",
          resolvedBy: "system",
          resolvedNote: "Auto-rejected by moderation agent",
          resolvedAt: new Date(),
        },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Listing Not Approved",
        body: `Your listing "${listing.title}" could not be published. Reasons: ${result.reasons.slice(0, 2).join(", ")}. Please edit and resubmit.`,
        metadata: {
          listingId: listing.id,
          reasons: result.reasons,
        },
      });
      break;
    }
  }
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateModerationMetrics(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "SELLING", date: today } },
    create: {
      agentType: "SELLING",
      date: today,
      itemsProcessed: 1,
    },
    update: {
      itemsProcessed: { increment: 1 },
    },
  });
}
