import type { BuyingStepContext } from "./types";

// ──────────────────────────────────────────────
// BUYING STRATEGY OPTIONS (used by wizard UI)
// Maps strategy IDs to i18n keys in buy.chat namespace
// ──────────────────────────────────────────────

export const BUYING_STRATEGY_OPTIONS = [
  { value: "TIME_ESCALATION", icon: "⏳", i18nKey: "strategyTimeEscalation" },
  { value: "MAX_BID", icon: "💪", i18nKey: "strategyMaxBid" },
  { value: "SNIPER", icon: "🎯", i18nKey: "strategySniper" },
  { value: "ACCEPT_LISTED", icon: "✅", i18nKey: "strategyAcceptListed" },
  { value: "EARLY_BIRD", icon: "🐦", i18nKey: "strategyEarlyBird" },
] as const;

/**
 * Show buying strategy selection step.
 * Called after monitoring frequency is set — always shown, not conditional.
 */
export async function showBuyingStrategySelection(ctx: BuyingStepContext) {
  ctx.setCurrentStep("strategy");
  await ctx.thinkAndRespond(
    ctx.t("chooseBuyingStrategy"),
    BUYING_STRATEGY_OPTIONS.map((s) => ({
      label: ctx.t(s.i18nKey),
      value: `strategy_${s.value}`,
    })),
  );
}

/**
 * Handle strategy selection action from the wizard.
 * Sets the strategy and advances to agent_proposal step.
 */
export function handleBuyingStrategyAction(
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
