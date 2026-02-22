/**
 * Agent Analytics — Platform health reporting & anomaly detection
 *
 * Daily CRON tasks:
 *   1. Generate platform health report (new users, listings, revenue, agent activity)
 *   2. Anomaly detection on sudden drops/spikes
 *   3. Store as AgentMetrics records
 *   4. Weekly summary generation
 */

import { db } from "@/server/db";
import { sendEmail } from "./email";
import { createNotification } from "./notification";
import { APP_NAME } from "@/lib/constants";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface PlatformHealthReport {
  date: string;
  users: {
    total: number;
    newToday: number;
    activeToday: number;
    trend: "up" | "down" | "stable";
  };
  listings: {
    total: number;
    newToday: number;
    activeTotal: number;
    soldToday: number;
    trend: "up" | "down" | "stable";
  };
  agents: {
    sellingActive: number;
    buyingActive: number;
    matchesToday: number;
    actionsToday: number;
  };
  engagement: {
    messagesTotal: number;
    messagesToday: number;
    conversationsToday: number;
  };
  moderation: {
    escalationsPending: number;
    reportsPending: number;
    bansToday: number;
  };
  anomalies: Anomaly[];
}

export interface Anomaly {
  metric: string;
  severity: "info" | "warning" | "critical";
  message: string;
  currentValue: number;
  expectedValue: number;
  deviation: number; // percentage
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  highlights: string[];
  metrics: Record<string, number>;
  topCategories: { name: string; listings: number }[];
  growthRate: number;
}

// ──────────────────────────────────────────────
// MAIN: DAILY SNAPSHOT
// ──────────────────────────────────────────────

/** Generate the daily platform health report */
export async function generateDailyReport(): Promise<PlatformHealthReport> {
  console.log("[Analytics Agent] Generating daily report...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Gather all metrics in parallel
  const [
    totalUsers,
    newUsersToday,
    activeUsersToday,
    newUsersYesterday,
    totalListings,
    newListingsToday,
    activeListings,
    soldToday,
    newListingsYesterday,
    sellingAgents,
    buyingAgents,
    matchesToday,
    actionsToday,
    totalMessages,
    messagesToday,
    conversationsToday,
    pendingEscalations,
    pendingReports,
    bansToday,
    last7DaysUsers,
    last7DaysListings,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: today } } }),
    db.user.count({ where: { lastLoginAt: { gte: today } } }),
    db.user.count({
      where: { createdAt: { gte: yesterday, lt: today } },
    }),
    db.listing.count(),
    db.listing.count({ where: { createdAt: { gte: today } } }),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.listing.count({
      where: { status: "SOLD", updatedAt: { gte: today } },
    }),
    db.listing.count({
      where: { createdAt: { gte: yesterday, lt: today } },
    }),
    db.sellingAgent.count({ where: { status: "ACTIVE" } }),
    db.buyingAgent.count({ where: { status: "ACTIVE" } }),
    db.agentMatch.count({ where: { createdAt: { gte: today } } }),
    db.agentAction.count({ where: { createdAt: { gte: today } } }),
    db.message.count(),
    db.message.count({ where: { createdAt: { gte: today } } }),
    db.conversation.count({ where: { createdAt: { gte: today } } }),
    db.escalationItem.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.userBan.count({ where: { createdAt: { gte: today } } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.listing.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  // Determine trends
  const userTrend =
    newUsersToday > newUsersYesterday
      ? "up"
      : newUsersToday < newUsersYesterday
        ? "down"
        : "stable";
  const listingTrend =
    newListingsToday > newListingsYesterday
      ? "up"
      : newListingsToday < newListingsYesterday
        ? "down"
        : "stable";

  // Detect anomalies
  const anomalies = await detectAnomalies({
    newUsersToday,
    newListingsToday,
    messagesToday,
    matchesToday,
    soldToday,
    last7DaysUsers,
    last7DaysListings,
  });

  const report: PlatformHealthReport = {
    date: today.toISOString().split("T")[0],
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      activeToday: activeUsersToday,
      trend: userTrend as "up" | "down" | "stable",
    },
    listings: {
      total: totalListings,
      newToday: newListingsToday,
      activeTotal: activeListings,
      soldToday,
      trend: listingTrend as "up" | "down" | "stable",
    },
    agents: {
      sellingActive: sellingAgents,
      buyingActive: buyingAgents,
      matchesToday,
      actionsToday,
    },
    engagement: {
      messagesTotal: totalMessages,
      messagesToday,
      conversationsToday,
    },
    moderation: {
      escalationsPending: pendingEscalations,
      reportsPending: pendingReports,
      bansToday,
    },
    anomalies,
  };

  // Store metrics
  await storeAnalyticsMetrics(report);

  // Notify admins of critical anomalies
  await notifyAnomalies(anomalies);

  console.log("[Analytics Agent] Daily report generated");
  return report;
}

// ──────────────────────────────────────────────
// ANOMALY DETECTION
// ──────────────────────────────────────────────

async function detectAnomalies(metrics: {
  newUsersToday: number;
  newListingsToday: number;
  messagesToday: number;
  matchesToday: number;
  soldToday: number;
  last7DaysUsers: number;
  last7DaysListings: number;
}): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get 7-day averages for comparison
  const avgNewUsersPerDay = metrics.last7DaysUsers / 7;
  const avgNewListingsPerDay = metrics.last7DaysListings / 7;

  // Also get historical AgentMetrics for comparison
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentMetrics = await db.agentMetrics.findMany({
    where: { date: { gte: sevenDaysAgo } },
  });

  const avgItemsProcessed =
    recentMetrics.length > 0
      ? recentMetrics.reduce((s, m) => s + m.itemsProcessed, 0) /
        recentMetrics.length
      : 0;

  // Check user signups
  if (avgNewUsersPerDay > 0) {
    const deviation =
      ((metrics.newUsersToday - avgNewUsersPerDay) / avgNewUsersPerDay) * 100;

    if (Math.abs(deviation) > 100) {
      anomalies.push({
        metric: "new_users",
        severity: deviation < 0 ? "critical" : "warning",
        message:
          deviation < 0
            ? `New user signups dropped ${Math.abs(deviation).toFixed(0)}% below average`
            : `New user signups spiked ${deviation.toFixed(0)}% above average`,
        currentValue: metrics.newUsersToday,
        expectedValue: Math.round(avgNewUsersPerDay),
        deviation: Math.round(deviation),
      });
    } else if (Math.abs(deviation) > 50) {
      anomalies.push({
        metric: "new_users",
        severity: "info",
        message: `New users ${deviation > 0 ? "above" : "below"} average by ${Math.abs(deviation).toFixed(0)}%`,
        currentValue: metrics.newUsersToday,
        expectedValue: Math.round(avgNewUsersPerDay),
        deviation: Math.round(deviation),
      });
    }
  }

  // Check new listings
  if (avgNewListingsPerDay > 0) {
    const deviation =
      ((metrics.newListingsToday - avgNewListingsPerDay) /
        avgNewListingsPerDay) *
      100;

    if (Math.abs(deviation) > 100) {
      anomalies.push({
        metric: "new_listings",
        severity: deviation < 0 ? "critical" : "warning",
        message:
          deviation < 0
            ? `New listings dropped ${Math.abs(deviation).toFixed(0)}% below average`
            : `New listings spiked ${deviation.toFixed(0)}% above average`,
        currentValue: metrics.newListingsToday,
        expectedValue: Math.round(avgNewListingsPerDay),
        deviation: Math.round(deviation),
      });
    }
  }

  // Check messages — sudden drop could mean platform issue
  if (metrics.messagesToday === 0 && avgItemsProcessed > 5) {
    anomalies.push({
      metric: "messages",
      severity: "critical",
      message: "No messages sent today — possible platform issue",
      currentValue: 0,
      expectedValue: Math.round(avgItemsProcessed),
      deviation: -100,
    });
  }

  // Check for moderation backlog
  const pendingEscalations = await db.escalationItem.count({
    where: { status: "PENDING" },
  });

  if (pendingEscalations > 20) {
    anomalies.push({
      metric: "escalation_backlog",
      severity: pendingEscalations > 50 ? "critical" : "warning",
      message: `${pendingEscalations} pending escalations need attention`,
      currentValue: pendingEscalations,
      expectedValue: 5,
      deviation: ((pendingEscalations - 5) / 5) * 100,
    });
  }

  return anomalies;
}

// ──────────────────────────────────────────────
// WEEKLY SUMMARY
// ──────────────────────────────────────────────

/** Generate a weekly summary report */
export async function generateWeeklySummary(): Promise<WeeklySummary> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  // This week's metrics
  const [
    newUsersThisWeek,
    newListingsThisWeek,
    soldThisWeek,
    messagesThisWeek,
    matchesThisWeek,
    newUsersPrevWeek,
    _newListingsPrevWeek,
  ] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: weekStart } } }),
    db.listing.count({ where: { createdAt: { gte: weekStart } } }),
    db.listing.count({
      where: { status: "SOLD", updatedAt: { gte: weekStart } },
    }),
    db.message.count({ where: { createdAt: { gte: weekStart } } }),
    db.agentMatch.count({ where: { createdAt: { gte: weekStart } } }),
    db.user.count({
      where: { createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    db.listing.count({
      where: { createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
  ]);

  // Top categories by new listings
  const topCategories = await db.category.findMany({
    where: { parentId: { not: null } },
    select: {
      name: true,
      slug: true,
      _count: {
        select: {
          listings: {
            where: { createdAt: { gte: weekStart } },
          },
        },
      },
    },
    orderBy: {
      listings: { _count: "desc" },
    },
    take: 5,
  });

  // Growth rate
  const userGrowthRate =
    newUsersPrevWeek > 0
      ? ((newUsersThisWeek - newUsersPrevWeek) / newUsersPrevWeek) * 100
      : newUsersThisWeek > 0
        ? 100
        : 0;

  // Highlights
  const highlights: string[] = [];
  if (newUsersThisWeek > 0)
    highlights.push(`${newUsersThisWeek} new users joined`);
  if (newListingsThisWeek > 0)
    highlights.push(`${newListingsThisWeek} new listings created`);
  if (soldThisWeek > 0) highlights.push(`${soldThisWeek} items sold`);
  if (matchesThisWeek > 0)
    highlights.push(`${matchesThisWeek} agent matches found`);
  if (userGrowthRate > 0)
    highlights.push(`User growth: +${userGrowthRate.toFixed(1)}%`);
  else if (userGrowthRate < 0)
    highlights.push(`User growth: ${userGrowthRate.toFixed(1)}%`);

  const summary: WeeklySummary = {
    weekStart: weekStart.toISOString().split("T")[0],
    weekEnd: now.toISOString().split("T")[0],
    highlights,
    metrics: {
      newUsers: newUsersThisWeek,
      newListings: newListingsThisWeek,
      itemsSold: soldThisWeek,
      messages: messagesThisWeek,
      agentMatches: matchesThisWeek,
    },
    topCategories: topCategories.map((c) => ({
      name: extractName(c.name),
      listings: c._count.listings,
    })),
    growthRate: Math.round(userGrowthRate * 10) / 10,
  };

  // Send weekly summary email to admins
  await sendWeeklySummaryEmail(summary);

  return summary;
}

// ──────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────

async function notifyAnomalies(anomalies: Anomaly[]): Promise<void> {
  const criticalAnomalies = anomalies.filter(
    (a) => a.severity === "critical" || a.severity === "warning",
  );

  if (criticalAnomalies.length === 0) return;

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "AGENT_ACTION",
      title: `Platform Alert: ${criticalAnomalies.length} anomal${criticalAnomalies.length > 1 ? "ies" : "y"} detected`,
      body: criticalAnomalies
        .map((a) => `[${a.severity.toUpperCase()}] ${a.message}`)
        .join("\n"),
      metadata: { anomalies: criticalAnomalies },
    });
  }
}

async function sendWeeklySummaryEmail(summary: WeeklySummary): Promise<void> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });

  const metricsRows = Object.entries(summary.metrics)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${key.replace(/([A-Z])/g, " $1")}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${value.toLocaleString()}</td></tr>`,
    )
    .join("");

  const topCatRows = summary.topCategories
    .map(
      (c) =>
        `<tr><td style="padding:4px 8px;">${c.name}</td><td style="padding:4px 8px;text-align:right;">${c.listings}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2>${APP_NAME} Weekly Report</h2>
      <p style="color:#6b7280;">${summary.weekStart} — ${summary.weekEnd}</p>

      <h3>Highlights</h3>
      <ul>${summary.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>

      <h3>Key Metrics</h3>
      <table style="width:100%;border-collapse:collapse;">${metricsRows}</table>

      <h3 style="margin-top:24px;">Top Categories</h3>
      <table style="width:100%;border-collapse:collapse;">${topCatRows}</table>

      <p style="margin-top:24px;padding:12px;background:${summary.growthRate >= 0 ? "#dcfce7" : "#fee2e2"};border-radius:8px;">
        <strong>Growth rate: ${summary.growthRate >= 0 ? "+" : ""}${summary.growthRate}%</strong>
        ${summary.growthRate >= 0 ? " — Keep it up!" : " — needs attention"}
      </p>
    </div>
  `;

  for (const admin of admins) {
    await sendEmail({
      to: admin.email,
      subject: `📊 ${APP_NAME} Weekly Report — ${summary.weekStart}`,
      html,
      text: `Weekly Report (${summary.weekStart}): ${summary.highlights.join(". ")}`,
    });
  }
}

// ──────────────────────────────────────────────
// METRICS STORAGE
// ──────────────────────────────────────────────

async function storeAnalyticsMetrics(
  report: PlatformHealthReport,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Store selling agent metrics
  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "SELLING", date: today } },
    create: {
      agentType: "SELLING",
      date: today,
      itemsProcessed: report.listings.newToday,
      activeInstances: report.agents.sellingActive,
    },
    update: {
      activeInstances: report.agents.sellingActive,
    },
  });

  // Store buying agent metrics
  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "BUYING", date: today } },
    create: {
      agentType: "BUYING",
      date: today,
      itemsProcessed: report.agents.matchesToday,
      activeInstances: report.agents.buyingActive,
    },
    update: {
      activeInstances: report.agents.buyingActive,
    },
  });
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
