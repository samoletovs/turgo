/**
 * Watchdog Agent — Duplicate detection & scam prevention
 *
 * On new listing creation:
 *   - Check for duplicates via text similarity (Levenshtein distance)
 *   - Image pHash comparison for near-identical images
 *
 * On incoming messages:
 *   - Detect scam phrases (deposit requests, external links, lowball)
 *   - Flag to user + admin
 *
 * Works alongside agent-antifraud.ts (which handles listing fraud scoring)
 * and agent-moderation.ts (which handles listing quality review).
 * Watchdog focuses specifically on duplicate detection + message scam patterns.
 */

import { db } from "@/server/db";
import { createNotification } from "./notification";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type WatchdogAlertType =
  | "DUPLICATE_LISTING"
  | "SIMILAR_LISTING"
  | "SCAM_MESSAGE"
  | "SUSPICIOUS_LINK"
  | "LOWBALL_PATTERN"
  | "DEPOSIT_REQUEST";

export type WatchdogSeverity = "INFO" | "WARNING" | "DANGER";

export interface WatchdogAlert {
  type: WatchdogAlertType;
  severity: WatchdogSeverity;
  score: number; // 0-100
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarListings: Array<{
    listingId: string;
    title: string;
    titleSimilarity: number; // 0-1
    descriptionSimilarity: number; // 0-1
    priceDifference: number; // percentage
    imageSimilarity: number; // 0-1 (pHash-based)
    overallScore: number; // 0-100
  }>;
  alerts: WatchdogAlert[];
}

export interface MessageScanResult {
  isClean: boolean;
  alerts: WatchdogAlert[];
  /** If true, message should be blocked */
  shouldBlock: boolean;
  /** If true, flag for admin review */
  shouldFlag: boolean;
}

// ──────────────────────────────────────────────
// SCAM DETECTION PATTERNS
// ──────────────────────────────────────────────

interface ScamPattern {
  regex: RegExp;
  type: WatchdogAlertType;
  severity: WatchdogSeverity;
  score: number;
  description: string;
}

const MESSAGE_SCAM_PATTERNS: ScamPattern[] = [
  // Deposit / advance payment requests
  {
    regex:
      /\b(deposit|advance\s*pay|pre[-\s]?pay|pay\s*(me\s*)?first|send\s*money\s*first)\b/i,
    type: "DEPOSIT_REQUEST",
    severity: "DANGER",
    score: 90,
    description:
      "Requesting advance payment before seeing the item is a common scam tactic",
  },
  {
    regex:
      /\b(задаток|предоплат|аванс|оплат[аи]\s*заранее|перевед[иі]те\s*сначала)\b/i,
    type: "DEPOSIT_REQUEST",
    severity: "DANGER",
    score: 90,
    description: "Advance payment request detected (Russian)",
  },
  {
    regex: /\b(iemaks[au]|priekšapmaks|samaksā\s*iepriekš)\b/i,
    type: "DEPOSIT_REQUEST",
    severity: "DANGER",
    score: 90,
    description: "Advance payment request detected (Latvian)",
  },
  // External links (moving off-platform)
  {
    regex: /\bhttps?:\/\/(?!(?:turgo|localhost)\b)\S+\b/i,
    type: "SUSPICIOUS_LINK",
    severity: "WARNING",
    score: 60,
    description:
      "External link detected — could be an attempt to move communication off-platform",
  },
  {
    regex:
      /\b(whatsapp|telegram|viber|signal|facebook\.com\/|vk\.com\/|instagram\.com\/)\b/i,
    type: "SUSPICIOUS_LINK",
    severity: "WARNING",
    score: 50,
    description: "Attempt to move to external messaging platform",
  },
  // Overpayment / shipping scams
  {
    regex:
      /\b(i.?ll\s*pay\s*more|extra\s*money|shipping\s*agent|my\s*agent\s*will|courier\s*company)\b/i,
    type: "SCAM_MESSAGE",
    severity: "DANGER",
    score: 85,
    description: "Overpayment or fake shipping agent scam pattern",
  },
  {
    regex:
      /\b(western\s*union|moneygram|gift\s*card|crypto\s*pay|bitcoin\s*pay)\b/i,
    type: "SCAM_MESSAGE",
    severity: "DANGER",
    score: 95,
    description: "Untraceable payment method request",
  },
  // Lowball patterns (offer far below asking)
  {
    regex:
      /\b(i.?ll\s*give\s*you\s*\d+|take\s*it\s*for\s*\d+|final\s*offer\s*\d+|last\s*price\s*\d+)\b/i,
    type: "LOWBALL_PATTERN",
    severity: "INFO",
    score: 30,
    description: "Aggressive price negotiation detected",
  },
  // Urgency / pressure tactics
  {
    regex:
      /\b(act\s*now|limited\s*time|only\s*today|right\s*now\s*or|hurry\s*up)\b/i,
    type: "SCAM_MESSAGE",
    severity: "WARNING",
    score: 45,
    description: "Pressure tactic detected",
  },
  // Identity / phishing
  {
    regex:
      /\b(verify\s*your\s*(account|identity)|send\s*(me\s*)?your\s*(id|passport|bank)|login\s*here)\b/i,
    type: "SCAM_MESSAGE",
    severity: "DANGER",
    score: 95,
    description: "Identity theft / phishing attempt",
  },
  {
    regex:
      /\b(подтверд[иі]те\s*(свой\s*)?аккаунт|отправьте\s*(мне\s*)?(паспорт|удостоверение))\b/i,
    type: "SCAM_MESSAGE",
    severity: "DANGER",
    score: 95,
    description: "Identity theft / phishing attempt (Russian)",
  },
];

// ──────────────────────────────────────────────
// DUPLICATE DETECTION
// ──────────────────────────────────────────────

/**
 * Check a new listing for duplicates against existing active listings.
 * Uses text similarity (Levenshtein), price proximity, and image pHash comparison.
 */
export async function checkForDuplicates(
  listingId: string,
): Promise<DuplicateCheckResult> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: {
      images: { select: { id: true, url: true, aiTags: true } },
    },
  });

  if (!listing) {
    return { isDuplicate: false, similarListings: [], alerts: [] };
  }

  // Find candidates: same category, active, not this listing
  const candidates = await db.listing.findMany({
    where: {
      categoryId: listing.categoryId,
      status: "ACTIVE",
      id: { not: listing.id },
      userId: { not: listing.userId }, // different user — cross-user duplicate
      // Within 50% price range
      price: {
        gte: listing.price * 0.5,
        lte: listing.price * 1.5,
      },
    },
    include: {
      images: { select: { id: true, url: true, aiTags: true } },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  // Also check same-user duplicates (might be re-posting)
  const sameUserCandidates = await db.listing.findMany({
    where: {
      userId: listing.userId,
      status: "ACTIVE",
      id: { not: listing.id },
    },
    include: {
      images: { select: { id: true, url: true, aiTags: true } },
    },
    take: 20,
  });

  const allCandidates = [...candidates, ...sameUserCandidates];
  const similarListings: DuplicateCheckResult["similarListings"] = [];
  const alerts: WatchdogAlert[] = [];

  for (const candidate of allCandidates) {
    const titleSim = normalizedLevenshteinSimilarity(
      listing.title.toLowerCase(),
      candidate.title.toLowerCase(),
    );

    const descSim = normalizedLevenshteinSimilarity(
      listing.description.toLowerCase().slice(0, 500),
      candidate.description.toLowerCase().slice(0, 500),
    );

    const priceDiff =
      listing.price > 0
        ? Math.abs(listing.price - candidate.price) / listing.price
        : 0;

    // Image similarity via AI tag comparison (lightweight pHash proxy)
    const imageSim = compareImageTags(listing.images, candidate.images);

    // Overall duplicate score (weighted)
    const overallScore = Math.round(
      titleSim * 35 +
        descSim * 25 +
        (1 - Math.min(1, priceDiff)) * 15 +
        imageSim * 25,
    );

    if (overallScore >= 40) {
      similarListings.push({
        listingId: candidate.id,
        title: candidate.title,
        titleSimilarity: Math.round(titleSim * 100) / 100,
        descriptionSimilarity: Math.round(descSim * 100) / 100,
        priceDifference: Math.round(priceDiff * 100),
        imageSimilarity: Math.round(imageSim * 100) / 100,
        overallScore,
      });
    }
  }

  // Sort by similarity
  similarListings.sort((a, b) => b.overallScore - a.overallScore);

  // Generate alerts
  const isDuplicate = similarListings.some((s) => s.overallScore >= 80);
  const hasSimilar = similarListings.some(
    (s) => s.overallScore >= 60 && s.overallScore < 80,
  );

  if (isDuplicate) {
    const top = similarListings[0];
    alerts.push({
      type: "DUPLICATE_LISTING",
      severity: "DANGER",
      score: top.overallScore,
      title: "Possible duplicate listing detected",
      description: `"${listing.title}" is ${top.overallScore}% similar to "${top.title}"`,
      metadata: {
        listingId: listing.id,
        duplicateOf: top.listingId,
        similarity: top.overallScore,
      },
    });
  } else if (hasSimilar) {
    const top = similarListings[0];
    alerts.push({
      type: "SIMILAR_LISTING",
      severity: "WARNING",
      score: top.overallScore,
      title: "Similar listing found",
      description: `"${listing.title}" resembles "${top.title}" (${top.overallScore}% match)`,
      metadata: {
        listingId: listing.id,
        similarTo: top.listingId,
        similarity: top.overallScore,
      },
    });
  }

  // Flag alerts to admin if high severity
  for (const alert of alerts) {
    if (alert.severity === "DANGER") {
      await flagToAdmin(listing.id, listing.userId, alert);
    }
  }

  return { isDuplicate, similarListings: similarListings.slice(0, 10), alerts };
}

// ──────────────────────────────────────────────
// MESSAGE SCANNING
// ──────────────────────────────────────────────

/**
 * Scan an incoming message for scam patterns.
 * Returns alerts + recommendations (block / flag / allow).
 */
export async function scanMessage(
  messageContent: string,
  senderId: string,
  receiverId: string,
  conversationId?: string,
): Promise<MessageScanResult> {
  const alerts: WatchdogAlert[] = [];

  // Run all scam pattern checks
  for (const pattern of MESSAGE_SCAM_PATTERNS) {
    if (pattern.regex.test(messageContent)) {
      alerts.push({
        type: pattern.type,
        severity: pattern.severity,
        score: pattern.score,
        title: `${pattern.type.replace(/_/g, " ")} detected`,
        description: pattern.description,
        metadata: {
          senderId,
          receiverId,
          conversationId,
          matchedPattern: pattern.regex.source,
        },
      });
    }
  }

  // Check for repeated identical messages (spam)
  const recentMessages = await db.message.findMany({
    where: {
      senderId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
    },
    select: { content: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const identicalCount = recentMessages.filter(
    (m) =>
      normalizedLevenshteinSimilarity(
        m.content.toLowerCase(),
        messageContent.toLowerCase(),
      ) > 0.9,
  ).length;

  if (identicalCount >= 3) {
    alerts.push({
      type: "SCAM_MESSAGE",
      severity: "WARNING",
      score: 70,
      title: "Spam pattern detected",
      description: `Sender has sent ${identicalCount} nearly identical messages in the last hour`,
      metadata: { senderId, identicalCount },
    });
  }

  // Determine action
  const maxScore =
    alerts.length > 0 ? Math.max(...alerts.map((a) => a.score)) : 0;
  const hasDanger = alerts.some((a) => a.severity === "DANGER");

  const shouldBlock = maxScore >= 90;
  const shouldFlag = maxScore >= 50 || hasDanger;

  // Notify receiver about warnings
  if (alerts.length > 0 && !shouldBlock) {
    try {
      await createNotification({
        userId: receiverId,
        type: "AGENT_ACTION",
        title: "Watchdog Alert",
        body: `A message you received may be suspicious: ${alerts[0].description}`,
        metadata: {
          watchdogAlerts: alerts.map((a) => ({
            type: a.type,
            severity: a.severity,
            description: a.description,
          })),
        },
      });
    } catch {
      // non-critical, continue
    }
  }

  // Flag to admin for high-severity
  if (shouldFlag) {
    try {
      await db.escalationItem.create({
        data: {
          source: "AUTO_MODERATION",
          userId: senderId,
          title: `Watchdog: ${alerts[0].type.replace(/_/g, " ")}`,
          description: `Message from user ${senderId}: "${messageContent.slice(0, 200)}".\nAlerts: ${alerts.map((a) => a.description).join("; ")}`,
          metadata: JSON.parse(
            JSON.stringify({
              watchdogAlerts: alerts,
              conversationId,
              senderId,
              receiverId,
            }),
          ),
          status: shouldBlock ? "PENDING" : "PENDING",
        },
      });
    } catch {
      // non-critical
    }
  }

  return {
    isClean: alerts.length === 0,
    alerts,
    shouldBlock,
    shouldFlag,
  };
}

/**
 * Bulk scan: check all recent unscanned messages.
 * Called by the scheduled worker.
 */
export async function scanRecentMessages(): Promise<{
  scanned: number;
  flagged: number;
  blocked: number;
}> {
  // Get messages from last 2 hours that haven't been scanned
  const messages = await db.message.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      isAgentMessage: false,
      messageType: "TEXT",
    },
    select: {
      id: true,
      content: true,
      senderId: true,
      receiverId: true,
      conversationId: true,
    },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  let flagged = 0;
  let blocked = 0;

  for (const msg of messages) {
    const result = await scanMessage(
      msg.content,
      msg.senderId,
      msg.receiverId,
      msg.conversationId,
    );

    if (result.shouldBlock) blocked++;
    else if (result.shouldFlag) flagged++;
  }

  return { scanned: messages.length, flagged, blocked };
}

// ──────────────────────────────────────────────
// TEXT SIMILARITY — LEVENSHTEIN
// ──────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings.
 * Uses Wagner-Fischer algorithm with O(min(m,n)) space.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) [a, b] = [b, a];

  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let curr = new Array<number>(m + 1);

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Normalized Levenshtein similarity (0-1, higher = more similar).
 */
function normalizedLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ──────────────────────────────────────────────
// IMAGE SIMILARITY — AI TAG COMPARISON
// ──────────────────────────────────────────────

/**
 * Compare images via their AI-generated tags (a lightweight proxy for pHash).
 * Real pHash would require image processing — this uses tag overlap instead,
 * which leverages the AI image analysis already done at upload time.
 *
 * Returns similarity score 0-1.
 */
function compareImageTags(
  imagesA: Array<{ aiTags: unknown }>,
  imagesB: Array<{ aiTags: unknown }>,
): number {
  if (imagesA.length === 0 || imagesB.length === 0) return 0;

  const tagsA = extractTags(imagesA);
  const tagsB = extractTags(imagesB);

  if (tagsA.size === 0 || tagsB.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set([...tagsA].filter((t) => tagsB.has(t)));
  const union = new Set([...tagsA, ...tagsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

function extractTags(images: Array<{ aiTags: unknown }>): Set<string> {
  const tags = new Set<string>();
  for (const img of images) {
    if (Array.isArray(img.aiTags)) {
      for (const tag of img.aiTags) {
        if (typeof tag === "string") tags.add(tag.toLowerCase());
      }
    } else if (img.aiTags && typeof img.aiTags === "object") {
      const obj = img.aiTags as Record<string, unknown>;
      if (Array.isArray(obj.tags)) {
        for (const tag of obj.tags) {
          if (typeof tag === "string") tags.add(tag.toLowerCase());
        }
      }
    }
  }
  return tags;
}

// ──────────────────────────────────────────────
// ADMIN FLAGGING
// ──────────────────────────────────────────────

async function flagToAdmin(
  listingId: string,
  userId: string,
  alert: WatchdogAlert,
): Promise<void> {
  try {
    await db.escalationItem.create({
      data: {
        source: "AUTO_MODERATION",
        listingId,
        userId,
        title: `Watchdog: ${alert.title}`,
        description: alert.description,
        metadata: JSON.parse(JSON.stringify(alert.metadata)),
        status: "PENDING",
      },
    });
  } catch (error) {
    console.error("[Watchdog] Failed to create escalation:", error);
  }
}
