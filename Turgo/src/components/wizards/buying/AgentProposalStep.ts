import type { BuyingStepContext } from "./types";

// ──────────────────────────────────────────────
// AGENT PROPOSAL — explains what the agent will
// do for the selected buying strategy and lets
// user choose automation level
// ──────────────────────────────────────────────

/** Map strategy ID → i18n key for the proposal message */
const PROPOSAL_KEYS: Record<string, string> = {
  TIME_ESCALATION: "proposalTimeEscalation",
  MAX_BID: "proposalMaxBid",
  SNIPER: "proposalSniper",
  ACCEPT_LISTED: "proposalAcceptListed",
  EARLY_BIRD: "proposalEarlyBird",
};

/** Map strategy ID → i18n keys for what the agent actually DECIDES */
const STRATEGY_FEATURES: Record<string, string[]> = {
  TIME_ESCALATION: [
    "proposalMonitor",
    "proposalDealScore",
    "proposalAutoOffer",
    "proposalAutoEscalate",
    "proposalSellerAnalysis",
    "proposalPriceHistory",
  ],
  MAX_BID: [
    "proposalMonitor",
    "proposalDealScore",
    "proposalAutoOffer",
    "proposalSellerAnalysis",
  ],
  SNIPER: [
    "proposalMonitor",
    "proposalDealScore",
    "proposalAutoStrike",
    "proposalSellerAnalysis",
    "proposalPriceHistory",
  ],
  ACCEPT_LISTED: [],
  EARLY_BIRD: [
    "proposalMonitor",
    "proposalDealScore",
    "proposalAutoOffer",
    "proposalSellerAnalysis",
    "proposalPriceHistory",
  ],
};

/** Whether a strategy can work without agent automation */
const CAN_SKIP_AGENT: Record<string, boolean> = {
  TIME_ESCALATION: false,
  MAX_BID: false,
  SNIPER: false,
  ACCEPT_LISTED: true, // just offers listed price — no automation needed
  EARLY_BIRD: false,
};

/**
 * Show the agent proposal step after strategy selection.
 * The agent explains what it will do for the selected strategy.
 * @param strategyId - passed directly to avoid React state staleness
 */
export async function showBuyingAgentProposal(
  ctx: BuyingStepContext,
  strategyId:
    | "TIME_ESCALATION"
    | "MAX_BID"
    | "SNIPER"
    | "ACCEPT_LISTED"
    | "EARLY_BIRD",
) {
  ctx.setCurrentStep("agent_proposal");

  const proposalKey = PROPOSAL_KEYS[strategyId] || "proposalTimeEscalation";
  const featureKeys =
    STRATEGY_FEATURES[strategyId] || STRATEGY_FEATURES.TIME_ESCALATION;
  const canSkip = CAN_SKIP_AGENT[strategyId] ?? false;

  // Build message
  const features = featureKeys.map((k) => ctx.t(k)).join("\n");
  const message = features
    ? `${ctx.t(proposalKey)}\n${features}`
    : ctx.t(proposalKey);

  // Build action buttons
  const actions = [
    { label: ctx.t("enableAllAuto"), value: "auto_all" },
    { label: ctx.t("enableMonitorOnly"), value: "auto_monitor_only" },
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
 * Sets automation flags and returns whether to skip agent creation.
 */
export function handleBuyingProposalAction(
  value: string,
  ctx: BuyingStepContext,
): { skipAgent: boolean } {
  switch (value) {
    case "auto_all":
      ctx.updateData({
        autoOffer: true,
        autoNegotiate: true,
      });
      return { skipAgent: false };

    case "auto_monitor_only":
      ctx.updateData({
        autoOffer: false,
        autoNegotiate: false,
      });
      return { skipAgent: false };

    case "no_agent":
      ctx.updateData({
        autoOffer: false,
        autoNegotiate: false,
      });
      return { skipAgent: true };

    default:
      return { skipAgent: false };
  }
}
