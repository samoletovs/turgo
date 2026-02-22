/**
 * Agent Workers — BullMQ job processors for all agent background tasks
 *
 * Wires the orchestrator to actual service logic:
 *   - Selling agent: price adjustments, auto-respond, daily summaries
 *   - Buying agent: listing monitoring, auto-negotiate
 *   - Quality checks, analytics snapshots
 *   - SS.lv scraper (if enabled)
 */

import type { Job } from "bullmq";
import { db } from "@/server/db";
import { registerWorker } from "./agent-orchestrator";
import { shouldAdjustPrice, generateDailySummary } from "./agent-selling";
import { monitorForMatches, calculateDealScore } from "./agent-buying";
import {
  createNotification,
  sendPushNotification,
  sendAgentSummaryEmail,
} from "./notification";
import { sendAgentMatchNotification } from "./email";
import { runScraper } from "./scraper-sslv";
import { APP_URL } from "@/lib/constants";

// ──────────────────────────────────────────────
// SELLING AGENT WORKERS
// ──────────────────────────────────────────────

/** Process selling agent price adjustments */
async function processSellingPriceAdjust(job: Job): Promise<void> {
  console.log(`[Worker] Processing selling-agent-price-adjust`, job.data);

  // If a specific agentId is provided, process just that agent.
  // Otherwise, process ALL active selling agents (scheduled CRON job).
  const agentIds: string[] = job.data.agentId
    ? [job.data.agentId]
    : (
        await db.sellingAgent.findMany({
          where: { status: "ACTIVE" },
          select: { id: true },
        })
      ).map((a) => a.id);

  for (const agentId of agentIds) {
    try {
      const agent = await db.sellingAgent.findUnique({
        where: { id: agentId },
        include: {
          listing: {
            select: { id: true, title: true, price: true, viewCount: true },
          },
        },
      });

      if (!agent || agent.status !== "ACTIVE") continue;

      const result = shouldAdjustPrice({
        currentPrice: agent.listing.price,
        minimumPrice: agent.minimumPrice ?? agent.listing.price * 0.5,
        totalViews: agent.listing.viewCount ?? 0,
        totalInquiries: agent.totalInquiries,
        createdAt: agent.createdAt,
        urgency: agent.urgency,
      });

      if (result.shouldAdjust && result.newPrice != null) {
        // Update listing price
        await db.listing.update({
          where: { id: agent.listing.id },
          data: { price: result.newPrice },
        });

        // Log the action
        await db.agentAction.create({
          data: {
            sellingAgentId: agentId,
            agentType: "SELLING",
            actionType: "PRICE_ADJUST",
            description: `Price adjusted: €${agent.listing.price} → €${result.newPrice}. ${result.reason}`,
            metadata: {
              oldPrice: agent.listing.price,
              newPrice: result.newPrice,
              reason: result.reason,
            },
          },
        });

        // Notify seller
        await createNotification({
          userId: agent.userId,
          type: "AGENT_ACTION",
          title: "Price Adjusted",
          body: `Your selling agent adjusted "${agent.listing.title}" to €${result.newPrice}. ${result.reason}`,
          metadata: {
            agentId,
            listingId: agent.listing.id,
            newPrice: result.newPrice,
          },
        });

        console.log(
          `[Worker] Agent ${agentId}: price ${agent.listing.price} → ${result.newPrice}`,
        );
      }
    } catch (error) {
      console.error(
        `[Worker] Price adjust failed for agent ${agentId}:`,
        error,
      );
    }
  }
}

/** Process selling agent daily summaries */
async function processSellingDailySummary(job: Job): Promise<void> {
  console.log(`[Worker] Processing selling-agent-daily-summary`, job.data);

  const agents = await db.sellingAgent.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, userId: true },
  });

  for (const agent of agents) {
    try {
      const summary = await generateDailySummary(agent.id);
      if (!summary) continue;

      // Log the action
      await db.agentAction.create({
        data: {
          sellingAgentId: agent.id,
          agentType: "SELLING",
          actionType: "ALERT",
          description: `Daily summary: ${summary.highlights.join(", ") || "No activity"}`,
          metadata: JSON.parse(JSON.stringify(summary)),
        },
      });

      // Send email summary — need seller's email
      const user = await db.user.findUnique({
        where: { id: agent.userId },
        select: { email: true },
      });
      if (user?.email) {
        await sendAgentSummaryEmail({
          email: user.email,
          agentType: "SELLING",
          listingTitle: summary.listingTitle,
          metrics: summary.metrics,
          highlights: summary.highlights,
          recommendations: summary.recommendations,
        });
      }

      console.log(`[Worker] Daily summary sent for agent ${agent.id}`);
    } catch (error) {
      console.error(
        `[Worker] Daily summary failed for agent ${agent.id}:`,
        error,
      );
    }
  }
}

// ──────────────────────────────────────────────
// BUYING AGENT WORKERS
// ──────────────────────────────────────────────

/** Monitor listings for all active buying agents */
async function processBuyingAgentMonitor(job: Job): Promise<void> {
  console.log(`[Worker] Processing buying-agent-monitor`, job.data);

  // If a specific agentId given, process just that one
  const agentIds: string[] = job.data.agentId
    ? [job.data.agentId]
    : (
        await db.buyingAgent.findMany({
          where: { status: "ACTIVE" },
          select: { id: true },
        })
      ).map((a) => a.id);

  for (const agentId of agentIds) {
    try {
      const matchCount = await monitorForMatches(agentId);

      if (matchCount > 0) {
        // Fetch agent for notification
        const agent = await db.buyingAgent.findUnique({
          where: { id: agentId },
          select: {
            userId: true,
            notifyPush: true,
            notifyEmail: true,
            matches: {
              where: { status: "NEW" },
              take: matchCount,
              orderBy: { createdAt: "desc" },
              include: {
                listing: {
                  select: {
                    id: true,
                    title: true,
                    price: true,
                    currency: true,
                  },
                },
              },
            },
          },
        });

        if (agent) {
          // In-app notification
          await createNotification({
            userId: agent.userId,
            type: "AGENT_MATCH",
            title: `${matchCount} New Match${matchCount > 1 ? "es" : ""} Found!`,
            body:
              agent.matches.length > 0
                ? `Best match: "${agent.matches[0].listing.title}" — €${agent.matches[0].listing.price}`
                : `Your buying agent found ${matchCount} new listing(s) matching your criteria.`,
            metadata: { agentId, matchCount },
          });

          // Push notification
          if (agent.notifyPush) {
            await sendPushNotification({
              userId: agent.userId,
              title: `${matchCount} New Match${matchCount > 1 ? "es" : ""} Found!`,
              body:
                agent.matches.length > 0
                  ? `"${agent.matches[0].listing.title}" — €${agent.matches[0].listing.price}`
                  : `${matchCount} new listing(s) match your criteria.`,
              url: "/agents",
              tag: `agent-match-${agentId}`,
            });
          }

          // Email notification
          if (agent.notifyEmail && agent.matches.length > 0) {
            const user = await db.user.findUnique({
              where: { id: agent.userId },
              select: { email: true },
            });
            if (user?.email) {
              for (const match of agent.matches) {
                await sendAgentMatchNotification(user.email, {
                  listingTitle: match.listing.title,
                  dealScore: match.dealScore,
                  url: `${APP_URL}/listing/${match.listing.id}`,
                });
              }
            }
          }
        }

        console.log(
          `[Worker] Agent ${agentId}: found ${matchCount} new matches`,
        );
      }
    } catch (error) {
      console.error(
        `[Worker] Monitor failed for buying agent ${agentId}:`,
        error,
      );
    }
  }
}

/** Auto-negotiate for buying agents */
async function processBuyingAgentAutoNegotiate(job: Job): Promise<void> {
  console.log(`[Worker] Processing buying-agent-auto-negotiate`, job.data);

  const { agentId, matchId, listingId } = job.data as {
    agentId: string;
    matchId: string;
    listingId: string;
  };

  try {
    const agent = await db.buyingAgent.findUnique({
      where: { id: agentId },
      select: {
        userId: true,
        maxBudget: true,
        targetPrice: true,
        autoNegotiate: true,
        searchCriteria: true,
      },
    });

    if (!agent || !agent.autoNegotiate) return;

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, title: true, price: true, categoryId: true },
    });

    if (!listing) return;

    // Calculate deal score to determine negotiation strategy
    const score = await calculateDealScore({
      listingId,
      categoryId: listing.categoryId,
      targetPrice: agent.targetPrice ?? agent.maxBudget,
      maxBudget: agent.maxBudget,
    });

    // Only auto-negotiate for good deals (score >= 50)
    if (score.total < 50) {
      console.log(
        `[Worker] Deal score ${score.total} too low for auto-negotiate on ${listingId}`,
      );
      return;
    }

    // Determine offer price based on deal score
    const offerPercent =
      score.total >= 80 ? 0.95 : score.total >= 65 ? 0.9 : 0.85;
    const offerPrice = Math.min(
      agent.maxBudget,
      Math.round(listing.price * offerPercent),
    );

    // Log the action
    await db.agentAction.create({
      data: {
        buyingAgentId: agentId,
        agentType: "BUYING",
        actionType: "AUTO_NEGOTIATE",
        description: `Auto-offer: €${offerPrice} for "${listing.title}" (deal score: ${score.total}/100)`,
        metadata: {
          listingId,
          offerPrice,
          listingPrice: listing.price,
          dealScore: score.total,
        },
      },
    });

    // Update match status
    await db.agentMatch.update({
      where: { id: matchId },
      data: {
        status: "NEGOTIATING",
        autoOfferSent: true,
        offerPrice,
      },
    });

    // Notify the buyer
    await createNotification({
      userId: agent.userId,
      type: "AGENT_ACTION",
      title: "Auto-Offer Sent",
      body: `Your buying agent offered €${offerPrice} for "${listing.title}"`,
      metadata: { agentId, listingId, offerPrice },
    });

    console.log(
      `[Worker] Auto-offer €${offerPrice} sent for listing ${listingId}`,
    );
  } catch (error) {
    console.error(`[Worker] Auto-negotiate failed:`, error);
  }
}

// ──────────────────────────────────────────────
// QUALITY & ANALYTICS WORKERS
// ──────────────────────────────────────────────

/** Quality check for listings — flag low-quality or suspicious */
async function processQualityCheck(job: Job): Promise<void> {
  console.log(`[Worker] Processing quality-check`, job.data);

  try {
    // Get recent listings created in the last 24h
    const listings = await db.listing.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { images: true },
      take: 50,
    });

    let flagged = 0;

    for (const listing of listings) {
      let score = 50; // baseline

      // Image quality checks
      if (listing.images.length === 0) score -= 20;
      else if (listing.images.length >= 3) score += 15;
      else score += 5;

      // Description quality
      if (listing.description.length < 20) score -= 15;
      else if (listing.description.length > 100) score += 10;

      // Title quality
      if (listing.title.length < 5) score -= 10;
      else if (listing.title.length > 15) score += 5;

      // Price sanity
      if (listing.price <= 0) score -= 30;

      // Clamp
      score = Math.max(0, Math.min(100, score));

      // Flag low-quality listings for moderation
      if (score < 30) {
        await db.agentAction.create({
          data: {
            agentType: "SELLING",
            actionType: "ALERT",
            description: `Quality flag: "${listing.title}" scored ${score}/100`,
            metadata: { listingId: listing.id, qualityScore: score },
          },
        });
        flagged++;
      }
    }

    console.log(
      `[Worker] Quality checked ${listings.length} listings, flagged ${flagged}`,
    );
  } catch (error) {
    console.error(`[Worker] Quality check failed:`, error);
  }
}

/** Daily analytics snapshot — market stats per category */
async function processAnalyticsSnapshot(job: Job): Promise<void> {
  console.log(`[Worker] Processing analytics-snapshot`, job.data);

  try {
    const categories = await db.category.findMany({
      where: { parentId: { not: null } }, // leaf categories only
      select: { id: true, slug: true },
    });

    for (const category of categories) {
      const listings = await db.listing.findMany({
        where: { categoryId: category.id, status: "ACTIVE" },
        select: { price: true },
      });

      if (listings.length === 0) continue;

      const prices = listings.map((l) => l.price).sort((a, b) => a - b);
      const medianIdx = Math.floor(prices.length / 2);

      await db.marketSnapshot.create({
        data: {
          categoryId: category.id,
          date: new Date(),
          medianPrice: prices[medianIdx],
          avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
          minPrice: prices[0],
          maxPrice: prices[prices.length - 1],
          listingCount: prices.length,
        },
      });
    }

    console.log(
      `[Worker] Analytics snapshot completed for ${categories.length} categories`,
    );
  } catch (error) {
    console.error(`[Worker] Analytics snapshot failed:`, error);
  }
}

/** Scraper worker — runs SS.lv scraper */
async function processScraperJob(job: Job): Promise<void> {
  console.log(`[Worker] Processing scraper-sslv`, job.data);

  try {
    const result = await runScraper();
    console.log(`[Worker] Scraper result:`, result);
  } catch (error) {
    console.error(`[Worker] Scraper failed:`, error);
  }
}

// ──────────────────────────────────────────────
// WORKER REGISTRATION
// ──────────────────────────────────────────────

/** Register all agent workers — called from initializeOrchestrator() */
export function registerAllWorkers(): void {
  console.log("[Agent Workers] Registering all workers...");

  // Selling agent queue
  registerWorker("selling-agents", async (job: Job) => {
    switch (job.name) {
      case "selling-agent-price-adjust":
        return processSellingPriceAdjust(job);
      case "selling-agent-auto-respond":
        // Auto-respond is handled synchronously in messaging.ts
        // This is for retry/queued messages only
        console.log(`[Worker] Auto-respond job (deferred):`, job.data);
        break;
      case "selling-agent-daily-summary":
        return processSellingDailySummary(job);
      default:
        console.warn(`[Worker] Unknown selling agent job: ${job.name}`);
    }
  });

  // Buying agent queue
  registerWorker("buying-agents", async (job: Job) => {
    switch (job.name) {
      case "buying-agent-monitor":
        return processBuyingAgentMonitor(job);
      case "buying-agent-auto-negotiate":
        return processBuyingAgentAutoNegotiate(job);
      default:
        console.warn(`[Worker] Unknown buying agent job: ${job.name}`);
    }
  });

  // Quality check queue
  registerWorker("quality", async (job: Job) => {
    switch (job.name) {
      case "quality-check":
        return processQualityCheck(job);
      case "moderation-review":
        console.log(`[Worker] Moderation review:`, job.data);
        break;
      default:
        console.warn(`[Worker] Unknown quality job: ${job.name}`);
    }
  });

  // Analytics queue
  registerWorker("analytics", async (job: Job) => {
    switch (job.name) {
      case "analytics-snapshot":
        return processAnalyticsSnapshot(job);
      default:
        console.warn(`[Worker] Unknown analytics job: ${job.name}`);
    }
  });

  // Scraper queue
  registerWorker("scraper", async (job: Job) => {
    switch (job.name) {
      case "scraper-sslv":
        return processScraperJob(job);
      default:
        console.warn(`[Worker] Unknown scraper job: ${job.name}`);
    }
  });

  console.log("[Agent Workers] All workers registered successfully");
}
