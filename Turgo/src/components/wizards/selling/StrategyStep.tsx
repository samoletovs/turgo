import type { SellingStepContext } from "./types";

// ──────────────────────────────────────────────
// SELLING STRATEGY OPTIONS (used by wizard UI)
// Maps strategy IDs to i18n keys in sell.chat namespace
// ──────────────────────────────────────────────

export const SELLING_STRATEGY_OPTIONS = [
  { value: "SEALED_BID", icon: "🔒", i18nKey: "strategySealedBid" },
  { value: "FIXED_PRICE", icon: "💲", i18nKey: "strategyFixedPrice" },
  { value: "DUTCH_AUCTION", icon: "📉", i18nKey: "strategyDutchAuction" },
] as const;

/**
 * Show strategy selection step.
 * Called after minimum price is set — always shown, not conditional.
 */
export async function showSellingStrategySelection(ctx: SellingStepContext) {
  ctx.setCurrentStep("strategy");
  await ctx.thinkAndRespond(
    ctx.t("chooseSellingStrategy"),
    SELLING_STRATEGY_OPTIONS.map((s) => ({
      label: ctx.t(s.i18nKey),
      value: `strategy_${s.value}`,
    })),
  );
}

/**
 * Handle strategy selection action from the wizard.
 * Sets the strategy and advances to agent_proposal step.
 */
export function handleSellingStrategyAction(
  value: string,
  ctx: SellingStepContext,
) {
  const strategyId = value.replace("strategy_", "") as
    | "SEALED_BID"
    | "FIXED_PRICE"
    | "DUTCH_AUCTION";
  ctx.updateData({ sellingStrategyId: strategyId });
}
