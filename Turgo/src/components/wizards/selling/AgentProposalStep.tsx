import type { SellingStepContext } from "./types";

// ──────────────────────────────────────────────
// AGENT PROPOSAL — explains what the agent will
// do for the selected strategy and lets user
// choose automation level
// ──────────────────────────────────────────────

/** Map strategy ID → i18n key for the proposal message */
const PROPOSAL_KEYS: Record<string, string> = {
  SEALED_BID: "proposalSealedBid",
  FIXED_PRICE: "proposalFixedPrice",
  DUTCH_AUCTION: "proposalDutchAuction",
};

/** Map strategy ID → i18n keys for what the agent actually DECIDES */
const STRATEGY_FEATURES: Record<string, string[]> = {
  SEALED_BID: [
    "proposalBuyerComms",
    "proposalOfferEval",
    "proposalOfferRecommend",
    "proposalAutoRejectBelow",
    "proposalMarketIntel",
    "proposalDailySummary",
  ],
  FIXED_PRICE: [
    "proposalBuyerComms",
    "proposalAutoAcceptAtPrice",
    "proposalMarketIntel",
    "proposalEngagementAnalysis",
    "proposalDailySummary",
  ],
  DUTCH_AUCTION: [
    "proposalBuyerComms",
    "proposalAdaptivePriceDrop",
    "proposalEngagementAnalysis",
    "proposalMarketIntel",
    "proposalDailySummary",
  ],
};

/** Whether a strategy can work without agent automation */
const CAN_SKIP_AGENT: Record<string, boolean> = {
  SEALED_BID: true,
  FIXED_PRICE: true,
  DUTCH_AUCTION: false, // requires automation for price drops
};

/**
 * Show the agent proposal step after strategy selection.
 * The agent explains what it will do for the selected strategy.
 * @param strategyId - passed directly to avoid React state staleness
 */
export async function showSellingAgentProposal(
  ctx: SellingStepContext,
  strategyId: "SEALED_BID" | "FIXED_PRICE" | "DUTCH_AUCTION",
) {
  ctx.setCurrentStep("agent_proposal");

  const proposalKey = PROPOSAL_KEYS[strategyId] || "proposalSealedBid";
  const featureKeys =
    STRATEGY_FEATURES[strategyId] || STRATEGY_FEATURES.SEALED_BID;
  const canSkip = CAN_SKIP_AGENT[strategyId] ?? true;

  // Build features list
  const features = featureKeys.map((k) => ctx.t(k)).join("\n");
  const message = `${ctx.t(proposalKey)}\n${features}`;

  // Build action buttons
  const actions = [
    { label: ctx.t("enableAllAuto"), value: "auto_all" },
    { label: ctx.t("enableNegotiateOnly"), value: "auto_negotiate_only" },
    { label: ctx.t("enableBoostOnly"), value: "auto_boost_only" },
  ];

  if (canSkip) {
    actions.push({
      label: ctx.t("noAgentNeeded"),
      value: "no_agent",
    });
  }

  await ctx.thinkAndRespond(message, actions);
}

/**
 * Handle automation choice from the agent proposal step.
 * Sets automation flags and advances to summary.
 */
export function handleSellingProposalAction(
  value: string,
  ctx: SellingStepContext,
): { skipAgent: boolean } {
  switch (value) {
    case "auto_all":
      ctx.updateData({
        autoRespond: true,
        autoNegotiate: true,
        autoBoost: true,
      });
      return { skipAgent: false };

    case "auto_negotiate_only":
      ctx.updateData({
        autoRespond: true,
        autoNegotiate: true,
        autoBoost: false,
      });
      return { skipAgent: false };

    case "auto_boost_only":
      ctx.updateData({
        autoRespond: true,
        autoNegotiate: false,
        autoBoost: true,
      });
      return { skipAgent: false };

    case "no_agent":
      ctx.updateData({
        autoRespond: false,
        autoNegotiate: false,
        autoBoost: false,
      });
      return { skipAgent: true };

    default:
      return { skipAgent: false };
  }
}
