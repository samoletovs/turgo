/**
 * Agent Workers — BullMQ job processors for all agent background tasks
 *
 * Wires the orchestrator to actual service logic:
 *   - Selling agent: price adjustments, auto-respond, daily summaries
 *   - Buying agent: listing monitoring, auto-negotiate
 *   - SS.lv scraper (if enabled)
 */

import type { Job } from "bullmq";
import { db } from "@/server/db";
import { registerWorker } from "./agent-orchestrator";
import { shouldAdjustPrice, generateDailySummary } from "./agent-selling";
import { monitorForMatches, executeBuyingStrategy } from "./agent-buying";
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
        currentPrice: Number(agent.listing.price),
        minimumPrice: agent.minimumPrice ?? Number(agent.listing.price) * 0.5,
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
            description: `Price adjusted: €${Number(agent.listing.price)} → €${result.newPrice}. ${result.reason}`,
            metadata: {
              oldPrice: Number(agent.listing.price),
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
          `[Worker] Agent ${agentId}: price ${Number(agent.listing.price)} → ${result.newPrice}`,
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
                ? `Best match: "${agent.matches[0].listing.title}" — €${Number(agent.matches[0].listing.price)}`
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
                  ? `"${agent.matches[0].listing.title}" — €${Number(agent.matches[0].listing.price)}`
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

/**
 * Strategy-based auto-negotiate for buying agents.
 *
 * The legacy hardcoded pricing logic (85-95% of listing price based on
 * deal score) has been replaced by the pluggable strategy pattern.
 * This worker now delegates to executeBuyingStrategy() which uses
 * the agent's selected BuyingStrategyId (TIME_ESCALATION, MAX_BID,
 * SNIPER, ACCEPT_LISTED, EARLY_BIRD, etc.) to calculate bids.
 *
 * The `autoNegotiate` boolean on BuyingAgent is kept as an
 * enable/disable toggle — when true, the strategy runs automatically.
 */
async function processBuyingAgentAutoNegotiate(job: Job): Promise<void> {
  console.log(
    `[Worker] Processing buying-agent-auto-negotiate (strategy-based)`,
    job.data,
  );

  const { agentId } = job.data as {
    agentId: string;
    matchId?: string;
    listingId?: string;
  };

  try {
    // Check the autoNegotiate toggle
    const agent = await db.buyingAgent.findUnique({
      where: { id: agentId },
      select: { autoNegotiate: true, userId: true },
    });

    if (!agent || !agent.autoNegotiate) return;

    // Delegate entirely to the strategy-based bidding engine
    const offersSent = await executeBuyingStrategy(agentId);

    if (offersSent > 0) {
      await createNotification({
        userId: agent.userId,
        type: "AGENT_ACTION",
        title: `${offersSent} Auto-Offer${offersSent > 1 ? "s" : ""} Sent`,
        body: `Your buying agent sent ${offersSent} strategy-based offer${offersSent > 1 ? "s" : ""}.`,
        metadata: { agentId, offersSent },
      });
    }

    console.log(
      `[Worker] Strategy-based auto-negotiate: ${offersSent} offers sent for agent ${agentId}`,
    );
  } catch (error) {
    console.error(`[Worker] Auto-negotiate failed:`, error);
  }
}

// ──────────────────────────────────────────────
// SCRAPER WORKER
// ──────────────────────────────────────────────

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
