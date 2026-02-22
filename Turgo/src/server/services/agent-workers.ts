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
import { moderateListing } from "./agent-moderation";
import { checkListingFraud } from "./agent-antifraud";
import { handleSupportMessage } from "./agent-support";
import { runDailyQualityCheck } from "./agent-quality";
import { runSeoOptimization } from "./agent-seo";
import { runDailyEngagement } from "./agent-engagement";
import { generateDailyReport, generateWeeklySummary } from "./agent-analytics";
import {
  adjustLiquidationBatchPricing,
  getUserLiquidationBatches,
} from "./agent-liquidation";
import { checkForDuplicates, scanRecentMessages } from "./agent-watchdog";
import { getOptimalTiming } from "./agent-timing";
import { findSwapCandidates, runSwapMatching } from "./agent-swap";
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

  // Quality / Moderation queue
  registerWorker("quality", async (job: Job) => {
    switch (job.name) {
      case "quality-check":
        return processQualityCheck(job);
      case "quality-daily":
        console.log(`[Worker] Processing quality-daily`, job.data);
        try {
          const qualityReport = await runDailyQualityCheck();
          console.log(`[Worker] Quality daily complete:`, qualityReport);
        } catch (error) {
          console.error(`[Worker] Quality daily failed:`, error);
        }
        break;
      case "moderation-review": {
        console.log(`[Worker] Processing moderation-review`, job.data);
        const { listingId } = job.data as { listingId: string };
        if (listingId) {
          try {
            const modResult = await moderateListing(listingId);
            console.log(`[Worker] Moderation result:`, modResult.outcome);
          } catch (error) {
            console.error(`[Worker] Moderation failed:`, error);
          }
        }
        break;
      }
      case "moderation-antifraud": {
        console.log(`[Worker] Processing moderation-antifraud`, job.data);
        const { listingId: fraudListingId } = job.data as { listingId: string };
        if (fraudListingId) {
          try {
            const fraudResult = await checkListingFraud(fraudListingId);
            console.log(`[Worker] Anti-fraud result:`, fraudResult.action);
          } catch (error) {
            console.error(`[Worker] Anti-fraud failed:`, error);
          }
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown quality job: ${job.name}`);
    }
  });

  // Support queue
  registerWorker("support", async (job: Job) => {
    switch (job.name) {
      case "support-ticket": {
        console.log(`[Worker] Processing support-ticket`, job.data);
        const { userId, message, locale, history } = job.data as {
          userId: string;
          message: string;
          locale?: string;
          history?: {
            role: "system" | "user" | "assistant";
            content: string;
          }[];
        };
        try {
          const supportResult = await handleSupportMessage({
            userId,
            message,
            locale,
            history,
          });
          console.log(
            `[Worker] Support result: ${supportResult.category} (confidence: ${supportResult.confidence}%)`,
          );
        } catch (error) {
          console.error(`[Worker] Support ticket failed:`, error);
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown support job: ${job.name}`);
    }
  });

  // Engagement queue
  registerWorker("engagement", async (job: Job) => {
    switch (job.name) {
      case "engagement-daily":
        console.log(`[Worker] Processing engagement-daily`, job.data);
        try {
          const engReport = await runDailyEngagement();
          console.log(
            `[Worker] Engagement complete: ${engReport.totalSent} emails sent`,
          );
        } catch (error) {
          console.error(`[Worker] Engagement daily failed:`, error);
        }
        break;
      case "engagement-email":
        console.log(`[Worker] Processing engagement-email`, job.data);
        break;
      default:
        console.warn(`[Worker] Unknown engagement job: ${job.name}`);
    }
  });

  // Analytics queue
  registerWorker("analytics", async (job: Job) => {
    switch (job.name) {
      case "analytics-snapshot":
        console.log(`[Worker] Processing analytics-snapshot`, job.data);
        try {
          const analyticsReport = await generateDailyReport();
          console.log(
            `[Worker] Analytics daily: ${analyticsReport.users.newToday} new users, ${analyticsReport.listings.newToday} new listings, ${analyticsReport.anomalies.length} anomalies`,
          );
          // Also run market snapshot
          await processAnalyticsSnapshot(job);
        } catch (error) {
          console.error(`[Worker] Analytics snapshot failed:`, error);
        }
        break;
      case "analytics-weekly":
        console.log(`[Worker] Processing analytics-weekly`, job.data);
        try {
          const weeklySummary = await generateWeeklySummary();
          console.log(
            `[Worker] Weekly summary: growth ${weeklySummary.growthRate}%`,
          );
        } catch (error) {
          console.error(`[Worker] Weekly summary failed:`, error);
        }
        break;
      default:
        console.warn(`[Worker] Unknown analytics job: ${job.name}`);
    }
  });

  // SEO queue
  registerWorker("seo", async (job: Job) => {
    switch (job.name) {
      case "seo-optimization":
        console.log(`[Worker] Processing seo-optimization`, job.data);
        try {
          const seoReport = await runSeoOptimization();
          console.log(
            `[Worker] SEO: ${seoReport.listingsOptimized} listings, ${seoReport.categoriesOptimized} categories, ${seoReport.sitemapEntries} sitemap entries`,
          );
        } catch (error) {
          console.error(`[Worker] SEO optimization failed:`, error);
        }
        break;
      default:
        console.warn(`[Worker] Unknown SEO job: ${job.name}`);
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

  // Liquidation queue
  registerWorker("liquidation", async (job: Job) => {
    switch (job.name) {
      case "liquidation-price-adjust": {
        console.log(`[Worker] Processing liquidation-price-adjust`, job.data);
        try {
          // If specific batchId provided, adjust that batch only
          const batchIds: string[] = job.data.batchId
            ? [job.data.batchId]
            : await getAllActiveLiquidationBatchIds();

          for (const batchId of batchIds) {
            try {
              const result = await adjustLiquidationBatchPricing(batchId);
              console.log(
                `[Worker] Liquidation batch ${batchId}: adjusted ${result.adjusted}, skipped ${result.skipped}`,
              );
            } catch (error) {
              console.error(
                `[Worker] Liquidation pricing failed for batch ${batchId}:`,
                error,
              );
            }
          }
        } catch (error) {
          console.error(`[Worker] Liquidation price-adjust failed:`, error);
        }
        break;
      }
      case "liquidation-batch-check": {
        console.log(`[Worker] Processing liquidation-batch-check`, job.data);
        try {
          // Check for expired liquidation agents and mark them completed
          const expiredAgents = await db.sellingAgent.findMany({
            where: {
              status: "ACTIVE",
              deadline: { lte: new Date() },
              strategy: { path: ["type"], equals: "liquidation" },
            },
            select: {
              id: true,
              userId: true,
              listing: { select: { id: true, title: true } },
            },
          });

          for (const agent of expiredAgents) {
            await db.sellingAgent.update({
              where: { id: agent.id },
              data: { status: "COMPLETED", completedAt: new Date() },
            });

            await db.agentAction.create({
              data: {
                sellingAgentId: agent.id,
                agentType: "SELLING",
                actionType: "ALERT",
                description: `Liquidation deadline reached for "${agent.listing.title}". Agent completed.`,
                metadata: { reason: "deadline_reached" },
              },
            });

            await createNotification({
              userId: agent.userId,
              type: "AGENT_ACTION",
              title: "Liquidation Deadline Reached",
              body: `Your liquidation listing "${agent.listing.title}" has reached its deadline.`,
              metadata: { agentId: agent.id },
            });
          }

          console.log(
            `[Worker] Liquidation batch check: ${expiredAgents.length} expired agents completed`,
          );
        } catch (error) {
          console.error(`[Worker] Liquidation batch check failed:`, error);
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown liquidation job: ${job.name}`);
    }
  });

  // Watchdog queue
  registerWorker("watchdog", async (job: Job) => {
    switch (job.name) {
      case "watchdog-duplicate-check": {
        console.log(`[Worker] Processing watchdog-duplicate-check`, job.data);
        const { listingId } = job.data as { listingId: string };
        if (listingId) {
          try {
            const result = await checkForDuplicates(listingId);
            console.log(
              `[Worker] Watchdog duplicate check: ${result.similarListings.length} similar found, isDuplicate=${result.isDuplicate}`,
            );
          } catch (error) {
            console.error(`[Worker] Watchdog duplicate check failed:`, error);
          }
        }
        break;
      }
      case "watchdog-message-scan": {
        console.log(`[Worker] Processing watchdog-message-scan`, job.data);
        try {
          const result = await scanRecentMessages();
          console.log(
            `[Worker] Watchdog message scan: ${result.scanned} scanned, ${result.flagged} flagged, ${result.blocked} blocked`,
          );
        } catch (error) {
          console.error(`[Worker] Watchdog message scan failed:`, error);
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown watchdog job: ${job.name}`);
    }
  });

  // Timing queue
  registerWorker("timing", async (job: Job) => {
    switch (job.name) {
      case "timing-snapshot": {
        console.log(`[Worker] Processing timing-snapshot`, job.data);
        try {
          // Pre-compute timing data for popular categories
          const categories = await db.category.findMany({
            where: { parentId: { not: null }, isActive: true },
            select: { id: true, slug: true },
            take: 50,
          });

          let processed = 0;
          for (const category of categories) {
            try {
              await getOptimalTiming(category.id);
              processed++;
            } catch {
              // continue
            }
          }
          console.log(
            `[Worker] Timing snapshot: processed ${processed}/${categories.length} categories`,
          );
        } catch (error) {
          console.error(`[Worker] Timing snapshot failed:`, error);
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown timing job: ${job.name}`);
    }
  });

  // Swap queue
  registerWorker("swap", async (job: Job) => {
    switch (job.name) {
      case "swap-matching": {
        console.log(`[Worker] Processing swap-matching`, job.data);
        try {
          // If specific userId provided, match for that user only
          if (job.data.userId) {
            const result = await runSwapMatching(job.data.userId as string);
            console.log(
              `[Worker] Swap matching for user ${job.data.userId}: ${result.listingsChecked} checked, ${result.swapsFound} found`,
            );
          } else {
            // Find users with active listings and run matching
            const activeUsers = await db.listing.findMany({
              where: { status: "ACTIVE" },
              select: { userId: true },
              distinct: ["userId"],
              take: 50,
            });

            let totalSwaps = 0;
            for (const { userId } of activeUsers) {
              try {
                const result = await runSwapMatching(userId);
                totalSwaps += result.swapsFound;
              } catch {
                // continue
              }
            }
            console.log(
              `[Worker] Swap matching: ${activeUsers.length} users, ${totalSwaps} swaps found`,
            );
          }
        } catch (error) {
          console.error(`[Worker] Swap matching failed:`, error);
        }
        break;
      }
      default:
        console.warn(`[Worker] Unknown swap job: ${job.name}`);
    }
  });

  console.log("[Agent Workers] All workers registered successfully");
}

/** Helper: get all active liquidation batch IDs */
async function getAllActiveLiquidationBatchIds(): Promise<string[]> {
  const agents = await db.sellingAgent.findMany({
    where: {
      status: "ACTIVE",
      strategy: { path: ["type"], equals: "liquidation" },
    },
    select: { strategy: true },
  });

  const batchIds = new Set<string>();
  for (const agent of agents) {
    const strat = agent.strategy as Record<string, unknown> | null;
    if (strat?.batchId && typeof strat.batchId === "string") {
      batchIds.add(strat.batchId);
    }
  }
  return Array.from(batchIds);
}
