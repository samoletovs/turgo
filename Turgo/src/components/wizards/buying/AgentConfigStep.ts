import type { BuyingStepContext } from "./types";
import { MONITOR_FREQ } from "./types";

// ──────────────────────────────────────────────
// BUYING STRATEGY SELECTION CONSTANTS
// ──────────────────────────────────────────────

export const BUYING_STRATEGY_OPTIONS = [
  {
    value: "TIME_ESCALATION",
    icon: "⏳",
    label: "Time Escalation",
    desc: "Start low, increase over time",
  },
  {
    value: "MAX_BID",
    icon: "💪",
    label: "Max Bid",
    desc: "Offer max budget immediately",
  },
  {
    value: "SNIPER",
    icon: "🎯",
    label: "Sniper",
    desc: "Wait, then strike at expiry",
  },
  {
    value: "ACCEPT_LISTED",
    icon: "✅",
    label: "Accept Listed Price",
    desc: "Offer the listed price directly",
  },
  {
    value: "EARLY_BIRD",
    icon: "🐦",
    label: "Early Bird",
    desc: "Bid early at 60–70% of listing price",
  },
] as const;

/**
 * Handle buying strategy selection action from the wizard.
 */
export function handleBuyingStrategySelection(
  value: string,
  ctx: BuyingStepContext,
) {
  const strategyId = value.replace("strategy_", "") as
    | "TIME_ESCALATION"
    | "MAX_BID"
    | "SNIPER"
    | "ACCEPT_LISTED"
    | "EARLY_BIRD";
  ctx.updateData({ buyingStrategyId: strategyId });
}

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleAgentConfigInput(
  content: string,
  ctx: BuyingStepContext,
) {
  const lower = content.toLowerCase().trim();

  // Parse monitoring frequency from free text
  if (lower.includes("5") && lower.includes("min")) {
    ctx.updateData({ monitorFrequency: 5 });
  } else if (lower.includes("15") && lower.includes("min")) {
    ctx.updateData({ monitorFrequency: 15 });
  } else if (lower.includes("hour")) {
    ctx.updateData({ monitorFrequency: 60 });
  } else if (
    lower.includes("daily") ||
    lower.includes("day") ||
    lower.includes("digest")
  ) {
    ctx.updateData({ monitorFrequency: 1440 });
  } else {
    // Try to extract a number and match to closest frequency
    const num = parseInt(content.replace(/\D/g, ""), 10);
    if (!isNaN(num)) {
      const closest = MONITOR_FREQ.reduce((prev, curr) =>
        Math.abs(parseInt(curr.value, 10) - num) <
        Math.abs(parseInt(prev.value, 10) - num)
          ? curr
          : prev,
      );
      ctx.updateData({ monitorFrequency: parseInt(closest.value, 10) });
    }
    // If still no match, keep the default (5 min)
  }

  if (ctx.data.autoNegotiate) {
    // Show strategy selection before summary when auto-negotiate is on
    await ctx.thinkAndRespond(
      "How should your agent negotiate offers?",
      BUYING_STRATEGY_OPTIONS.map((o) => ({
        label: `${o.icon} ${o.label}`,
        value: `strategy_${o.value}`,
        desc: o.desc,
      })),
    );
  } else {
    ctx.setCurrentStep("summary");
    await buildBuyingSummary(ctx);
  }
}

// ──────────────────────────────────────────────
// BUILD SUMMARY
// ──────────────────────────────────────────────

export async function buildBuyingSummary(ctx: BuyingStepContext) {
  await ctx.thinkAndRespond(
    ctx.t("summary", {
      query: ctx.data.searchQuery || "Your item",
      category: ctx.data.categoryName || "All",
      idealPrice: String(ctx.data.idealPrice),
      maxPrice: String(ctx.data.maxPrice),
      location: ctx.data.locationName || "Anywhere",
      condition: ctx.data.condition === "ANY" ? "Any" : ctx.data.condition,
      frequency: String(ctx.data.monitorFrequency),
    }),
    [
      { label: ctx.t("startMonitoring"), value: "create_agent" },
      { label: ctx.t("adjustCriteria"), value: "edit" },
    ],
  );
}
