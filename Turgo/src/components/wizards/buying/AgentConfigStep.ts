import type { BuyingStepContext } from "./types";
import { MONITOR_FREQ } from "./types";
import { BUYING_STRATEGY_OPTIONS } from "./StrategyStep";

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

  // After frequency is set, always advance to strategy selection
  ctx.setCurrentStep("strategy");
  await ctx.thinkAndRespond(
    ctx.t("chooseBuyingStrategy"),
    BUYING_STRATEGY_OPTIONS.map((o) => ({
      label: ctx.t(o.i18nKey),
      value: `strategy_${o.value}`,
    })),
  );
}

// ──────────────────────────────────────────────
// BUILD SUMMARY
// ──────────────────────────────────────────────

/** Strategy name lookup for summary display */
const STRATEGY_LABELS: Record<string, string> = {
  TIME_ESCALATION: "⏳ Time Escalation",
  MAX_BID: "💪 Max Bid",
  SNIPER: "🎯 Sniper",
  ACCEPT_LISTED: "✅ Accept Listed Price",
  EARLY_BIRD: "🐦 Early Bird",
};

export async function buildBuyingSummary(ctx: BuyingStepContext) {
  const strategyLabel =
    STRATEGY_LABELS[ctx.data.buyingStrategyId] || ctx.data.buyingStrategyId;

  await ctx.thinkAndRespond(
    ctx.t("summary", {
      query: ctx.data.searchQuery || "Your item",
      category: ctx.data.categoryName || "All",
      idealPrice: String(ctx.data.idealPrice),
      maxPrice: String(ctx.data.maxPrice),
      location: ctx.data.locationName || "Anywhere",
      condition: ctx.data.condition === "ANY" ? "Any" : ctx.data.condition,
      strategy: strategyLabel,
      frequency: String(ctx.data.monitorFrequency),
    }),
    [
      { label: ctx.t("startMonitoring"), value: "create_agent" },
      { label: ctx.t("adjustCriteria"), value: "edit" },
    ],
  );
}
