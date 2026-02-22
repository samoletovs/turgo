/**
 * Agent Anti-Fraud — Real-time fraud detection & prevention
 *
 * Checks:
 *   1. Impossible price (statistical outlier vs MarketSnapshot)
 *   2. Velocity check (too many listings from new account)
 *   3. Scam phrase detection in messages
 *   4. Behavioral scoring (account age, patterns, reputation)
 *
 * Outcomes:
 *   - Auto-block confirmed fraud
 *   - Flag suspicious activity for admin review
 *   - Track fraud metrics for dashboard
 */

import { db } from "@/server/db";
import { createNotification } from "./notification";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type FraudRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FraudCheckResult {
  risk: FraudRisk;
  score: number; // 0-100, higher = more suspicious
  checks: FraudCheck[];
  action: "ALLOW" | "FLAG" | "BLOCK";
  reasons: string[];
}

export interface FraudCheck {
  name: string;
  risk: FraudRisk;
  score: number;
  details: string;
}

// ──────────────────────────────────────────────
// SCAM PHRASES (messages)
// ──────────────────────────────────────────────

const MESSAGE_SCAM_PHRASES = [
  // Payment scams
  "pay outside",
  "pay directly",
  "send money",
  "wire transfer",
  "western union",
  "moneygram",
  "gift card",
  "google play card",
  "itunes card",
  "steam card",
  "crypto payment",
  "bitcoin payment",
  // Phishing
  "click this link",
  "verify your account",
  "update your payment",
  "your account will be",
  "suspended",
  "login here",
  // Overpayment scam
  "i will pay more",
  "extra money",
  "shipping agent",
  "my agent will pick up",
  "my assistant",
  // Urgency manipulation
  "act now",
  "limited time",
  "hurry",
  "don't miss",
  "once in a lifetime",
  "exclusive offer",
  // Russian scam phrases
  "оплата напрямую",
  "перевод через",
  "переведите деньги",
  "нажмите ссылку",
  "ваш аккаунт будет заблокирован",
  // Latvian scam phrases
  "maksājiet tieši",
  "nosūtiet naudu",
  "nospiediet saiti",
];

// ──────────────────────────────────────────────
// MAIN: LISTING FRAUD CHECK
// ──────────────────────────────────────────────

/** Run fraud checks on a listing and its author */
export async function checkListingFraud(
  listingId: string,
): Promise<FraudCheckResult> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
          isBanned: true,
          _count: { select: { listings: true, reviewsReceived: true } },
        },
      },
      category: { select: { id: true } },
      images: { select: { id: true } },
    },
  });

  if (!listing) {
    return {
      risk: "LOW",
      score: 0,
      checks: [],
      action: "ALLOW",
      reasons: ["Listing not found"],
    };
  }

  if (listing.user.isBanned) {
    return {
      risk: "CRITICAL",
      score: 100,
      checks: [],
      action: "BLOCK",
      reasons: ["User is banned"],
    };
  }

  const checks: FraudCheck[] = [];

  // 1. Impossible price check
  const priceCheck = await checkImpossiblePrice(
    listing.price,
    listing.categoryId,
  );
  checks.push(priceCheck);

  // 2. Velocity check
  const velocityCheck = await checkVelocity(
    listing.user.id,
    listing.user.createdAt,
  );
  checks.push(velocityCheck);

  // 3. Content analysis — scam indicators in listing text
  const contentCheck = checkListingContent(listing.title, listing.description);
  checks.push(contentCheck);

  // 4. Behavioral scoring
  const behaviorCheck = calculateBehaviorScore(
    listing.user.createdAt,
    listing.user._count.listings,
    listing.user._count.reviewsReceived,
    listing.images.length,
  );
  checks.push(behaviorCheck);

  // Calculate overall
  const totalScore = Math.round(
    checks.reduce((s, c) => s + c.score, 0) / checks.length,
  );
  const reasons = checks.filter((c) => c.score > 40).map((c) => c.details);

  let risk: FraudRisk;
  let action: "ALLOW" | "FLAG" | "BLOCK";

  if (totalScore >= 80) {
    risk = "CRITICAL";
    action = "BLOCK";
  } else if (totalScore >= 60) {
    risk = "HIGH";
    action = "FLAG";
  } else if (totalScore >= 35) {
    risk = "MEDIUM";
    action = "FLAG";
  } else {
    risk = "LOW";
    action = "ALLOW";
  }

  // Execute action
  await handleFraudAction(listing, {
    risk,
    score: totalScore,
    checks,
    action,
    reasons,
  });

  // Update metrics
  await updateFraudMetrics();

  return { risk, score: totalScore, checks, action, reasons };
}

// ──────────────────────────────────────────────
// MAIN: MESSAGE FRAUD CHECK
// ──────────────────────────────────────────────

/** Check a message for scam phrases in real-time */
export async function checkMessageFraud(
  messageContent: string,
  senderId: string,
): Promise<FraudCheckResult> {
  const checks: FraudCheck[] = [];

  // 1. Scam phrase detection
  const phraseCheck = detectScamPhrases(messageContent);
  checks.push(phraseCheck);

  // 2. Sender behavioral check
  const sender = await db.user.findUnique({
    where: { id: senderId },
    select: {
      createdAt: true,
      isBanned: true,
      _count: {
        select: { listings: true, reviewsReceived: true, sentMessages: true },
      },
    },
  });

  if (sender) {
    const behaviorCheck = calculateBehaviorScore(
      sender.createdAt,
      sender._count.listings,
      sender._count.reviewsReceived,
      0, // images not relevant for messages
    );
    checks.push(behaviorCheck);

    // 3. Message velocity — spamming?
    const recentMessages = await db.message.count({
      where: {
        senderId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
      },
    });

    const msgVelocityCheck: FraudCheck = {
      name: "message-velocity",
      risk:
        recentMessages > 50 ? "HIGH" : recentMessages > 20 ? "MEDIUM" : "LOW",
      score: Math.min(100, recentMessages * 2),
      details:
        recentMessages > 50
          ? `Sending ${recentMessages} messages/hour (spam pattern)`
          : recentMessages > 20
            ? `Elevated message rate: ${recentMessages}/hour`
            : `Normal message rate: ${recentMessages}/hour`,
    };
    checks.push(msgVelocityCheck);
  }

  const totalScore = Math.round(
    checks.reduce((s, c) => s + c.score, 0) / checks.length,
  );
  const reasons = checks.filter((c) => c.score > 40).map((c) => c.details);

  let risk: FraudRisk;
  let action: "ALLOW" | "FLAG" | "BLOCK";

  if (totalScore >= 75) {
    risk = "CRITICAL";
    action = "BLOCK";
  } else if (totalScore >= 50) {
    risk = "HIGH";
    action = "FLAG";
  } else if (totalScore >= 30) {
    risk = "MEDIUM";
    action = "FLAG";
  } else {
    risk = "LOW";
    action = "ALLOW";
  }

  return { risk, score: totalScore, checks, action, reasons };
}

// ──────────────────────────────────────────────
// CHECK 1: IMPOSSIBLE PRICE
// ──────────────────────────────────────────────

async function checkImpossiblePrice(
  price: number,
  categoryId: string,
): Promise<FraudCheck> {
  if (price <= 0) {
    return {
      name: "impossible-price",
      risk: "HIGH",
      score: 70,
      details: "Price is zero or negative",
    };
  }

  const snapshot = await db.marketSnapshot.findFirst({
    where: { categoryId },
    orderBy: { date: "desc" },
  });

  if (!snapshot || !snapshot.medianPrice) {
    return {
      name: "impossible-price",
      risk: "LOW",
      score: 10,
      details: "No market data for comparison",
    };
  }

  const median = snapshot.medianPrice;
  const ratio = price / median;

  // Price is less than 5% of median — almost certainly a scam
  if (ratio < 0.05) {
    return {
      name: "impossible-price",
      risk: "CRITICAL",
      score: 95,
      details: `Price €${price} is ${(ratio * 100).toFixed(1)}% of median €${median.toFixed(0)} — likely scam`,
    };
  }

  // Price is less than 15% of median — very suspicious
  if (ratio < 0.15) {
    return {
      name: "impossible-price",
      risk: "HIGH",
      score: 75,
      details: `Price €${price} is ${(ratio * 100).toFixed(1)}% of median €${median.toFixed(0)} — suspicious`,
    };
  }

  // Price is less than 25% of median — noteworthy
  if (ratio < 0.25) {
    return {
      name: "impossible-price",
      risk: "MEDIUM",
      score: 45,
      details: `Price €${price} is below market (median: €${median.toFixed(0)})`,
    };
  }

  // Extremely high price (10x+ median)
  if (ratio > 10) {
    return {
      name: "impossible-price",
      risk: "MEDIUM",
      score: 40,
      details: `Price €${price} is ${ratio.toFixed(1)}x the median — possibly inflated`,
    };
  }

  return {
    name: "impossible-price",
    risk: "LOW",
    score: 5,
    details: "Price within expected range",
  };
}

// ──────────────────────────────────────────────
// CHECK 2: VELOCITY CHECK
// ──────────────────────────────────────────────

async function checkVelocity(
  userId: string,
  accountCreatedAt: Date,
): Promise<FraudCheck> {
  const accountAgeDays =
    (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Count listings created in the last 24 hours
  const recentListings = await db.listing.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  // Count listings in the last week
  const weeklyListings = await db.listing.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  let score = 0;
  let risk: FraudRisk = "LOW";
  const issues: string[] = [];

  // New account (< 3 days) with many listings
  if (accountAgeDays < 3 && recentListings > 5) {
    score = 80;
    risk = "HIGH";
    issues.push(
      `New account (${accountAgeDays.toFixed(0)} days) with ${recentListings} listings in 24h`,
    );
  } else if (accountAgeDays < 7 && recentListings > 10) {
    score = 70;
    risk = "HIGH";
    issues.push(`Recent account with ${recentListings} listings in 24h`);
  } else if (recentListings > 20) {
    score = 60;
    risk = "MEDIUM";
    issues.push(`High volume: ${recentListings} listings in 24h`);
  } else if (accountAgeDays < 1 && recentListings > 3) {
    score = 55;
    risk = "MEDIUM";
    issues.push(`Brand new account with ${recentListings} listings on day 1`);
  } else if (weeklyListings > 30) {
    score = 40;
    risk = "MEDIUM";
    issues.push(`${weeklyListings} listings this week`);
  } else {
    score = 5;
    risk = "LOW";
  }

  return {
    name: "velocity-check",
    risk,
    score,
    details: issues.length > 0 ? issues.join("; ") : "Normal posting velocity",
  };
}

// ──────────────────────────────────────────────
// CHECK 3: CONTENT SCAM DETECTION (listings)
// ──────────────────────────────────────────────

function checkListingContent(title: string, description: string): FraudCheck {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;
  const matched: string[] = [];

  for (const phrase of MESSAGE_SCAM_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      score += 20;
      matched.push(phrase);
    }
  }

  // External link spam
  const urlCount = (text.match(/https?:\/\//gi) || []).length;
  if (urlCount > 3) {
    score += 15;
    matched.push(`${urlCount} external links`);
  }

  // Contact outside platform indicators
  if (/whatsapp|telegram|viber|signal/i.test(text)) {
    score += 15;
    matched.push("Contact outside platform");
  }

  score = Math.min(100, score);

  let risk: FraudRisk = "LOW";
  if (score >= 60) risk = "CRITICAL";
  else if (score >= 40) risk = "HIGH";
  else if (score >= 20) risk = "MEDIUM";

  return {
    name: "content-analysis",
    risk,
    score,
    details:
      matched.length > 0
        ? `Scam indicators: ${matched.join(", ")}`
        : "No scam indicators in content",
  };
}

// ──────────────────────────────────────────────
// CHECK 3b: SCAM PHRASE DETECTION (messages)
// ──────────────────────────────────────────────

function detectScamPhrases(content: string): FraudCheck {
  const lower = content.toLowerCase();
  let score = 0;
  const matched: string[] = [];

  for (const phrase of MESSAGE_SCAM_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      score += 25;
      matched.push(phrase);
    }
  }

  // Check for suspicious URLs in messages
  const urlMatch = lower.match(/https?:\/\/[^\s]+/gi);
  if (urlMatch && urlMatch.length > 0) {
    // Check for known phishing patterns
    for (const url of urlMatch) {
      if (
        /bit\.ly|tinyurl|goo\.gl|t\.co|shorturl/i.test(url) ||
        /login|verify|account|secure|update/i.test(url)
      ) {
        score += 30;
        matched.push(`Suspicious URL: ${url.slice(0, 50)}`);
      }
    }
  }

  score = Math.min(100, score);

  let risk: FraudRisk = "LOW";
  if (score >= 60) risk = "CRITICAL";
  else if (score >= 40) risk = "HIGH";
  else if (score >= 20) risk = "MEDIUM";

  return {
    name: "scam-phrase-detection",
    risk,
    score,
    details:
      matched.length > 0
        ? `Scam phrases found: ${matched.join(", ")}`
        : "No scam phrases detected",
  };
}

// ──────────────────────────────────────────────
// CHECK 4: BEHAVIORAL SCORING
// ──────────────────────────────────────────────

function calculateBehaviorScore(
  accountCreatedAt: Date,
  listingCount: number,
  reviewCount: number,
  imageCount: number,
): FraudCheck {
  let score = 50; // Start neutral
  const factors: string[] = [];

  const accountAgeDays =
    (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Account age — newer = more suspicious
  if (accountAgeDays < 1) {
    score += 25;
    factors.push("Brand new account (< 1 day)");
  } else if (accountAgeDays < 3) {
    score += 15;
    factors.push("Very new account (< 3 days)");
  } else if (accountAgeDays < 7) {
    score += 10;
    factors.push("New account (< 1 week)");
  } else if (accountAgeDays > 90) {
    score -= 20;
    factors.push("Established account (90+ days)");
  } else if (accountAgeDays > 30) {
    score -= 10;
    factors.push("Established account (30+ days)");
  }

  // Reviews — more positive reviews = less suspicious
  if (reviewCount >= 5) {
    score -= 15;
    factors.push(`Good reputation (${reviewCount} reviews)`);
  } else if (reviewCount >= 1) {
    score -= 5;
    factors.push(`Some reputation (${reviewCount} reviews)`);
  } else {
    score += 5;
    factors.push("No reviews yet");
  }

  // Images — listings without images are more suspicious
  if (imageCount === 0) {
    score += 10;
    factors.push("No images");
  } else if (imageCount >= 3) {
    score -= 5;
    factors.push("Good image count");
  }

  score = Math.max(0, Math.min(100, score));

  let risk: FraudRisk = "LOW";
  if (score >= 70) risk = "HIGH";
  else if (score >= 45) risk = "MEDIUM";

  return {
    name: "behavioral-score",
    risk,
    score,
    details:
      factors.length > 0
        ? `Behavioral factors: ${factors.join(", ")}`
        : "Behavior OK",
  };
}

// ──────────────────────────────────────────────
// ACTION HANDLING
// ──────────────────────────────────────────────

async function handleFraudAction(
  listing: { id: string; title: string; userId: string },
  result: FraudCheckResult,
): Promise<void> {
  switch (result.action) {
    case "BLOCK": {
      // Auto-reject the listing
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "REJECTED" },
      });

      // Ban the user with auto-ban flag
      await db.userBan.create({
        data: {
          userId: listing.userId,
          adminId: "system",
          reason: `Auto-blocked by anti-fraud agent (risk: ${result.risk}, score: ${result.score}). Reasons: ${result.reasons.join("; ")}`,
          isActive: true,
        },
      });

      // Mark user as banned
      await db.user.update({
        where: { id: listing.userId },
        data: { isBanned: true },
      });

      // Create escalation for admin review
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Auto-blocked: "${listing.title}" (fraud score: ${result.score})`,
          description: `Anti-fraud agent auto-blocked this listing and banned the user.\n\nRisk: ${result.risk}\nScore: ${result.score}/100\n\nReasons:\n${result.reasons.map((r) => `• ${r}`).join("\n")}\n\nChecks:\n${result.checks.map((c) => `• ${c.name}: ${c.risk} (${c.score}) — ${c.details}`).join("\n")}`,
          metadata: JSON.parse(
            JSON.stringify({
              fraudResult: {
                risk: result.risk,
                score: result.score,
                checks: result.checks,
              },
            }),
          ),
          status: "PENDING",
        },
      });

      // Notify admins
      const admins = await db.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: "AGENT_ACTION",
          title: "Fraud Auto-Block",
          body: `User auto-banned for fraud: "${listing.title}" (score: ${result.score})`,
          metadata: { listingId: listing.id, userId: listing.userId },
        });
      }
      break;
    }

    case "FLAG": {
      // Move listing to moderation
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "MODERATION" },
      });

      // Create escalation
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          listingId: listing.id,
          userId: listing.userId,
          title: `Suspicious: "${listing.title}" (fraud score: ${result.score})`,
          description: `Anti-fraud agent flagged this listing.\n\nRisk: ${result.risk}\nScore: ${result.score}/100\n\nReasons:\n${result.reasons.map((r) => `• ${r}`).join("\n")}`,
          metadata: JSON.parse(
            JSON.stringify({
              fraudResult: {
                risk: result.risk,
                score: result.score,
                checks: result.checks,
              },
            }),
          ),
          status: "PENDING",
        },
      });

      await createNotification({
        userId: listing.userId,
        type: "AGENT_ACTION",
        title: "Listing Under Review",
        body: `Your listing "${listing.title}" has been flagged for additional review.`,
        metadata: { listingId: listing.id },
      });
      break;
    }

    case "ALLOW":
      // No action needed
      break;
  }
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateFraudMetrics(): Promise<void> {
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
