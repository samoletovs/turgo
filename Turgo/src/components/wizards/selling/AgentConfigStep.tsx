import type { SellingStepContext } from "./types";
import { URGENCY_OPTIONS } from "./types";
import { URGENCY_HOURS } from "@/lib/constants";
import type { PricingCurvePoint } from "@/types";
import { PriceCurveVisualizer } from "@/components/price-curve-visualizer";

// ──────────────────────────────────────────────
// CLIENT-SIDE PRICE CURVE GENERATION
// (mirrors server-side generatePriceCurve)
// ──────────────────────────────────────────────

function generatePriceCurveClient(
  startPrice: number,
  minPrice: number,
  urgency: string,
): PricingCurvePoint[] {
  const totalHours = URGENCY_HOURS[urgency] || 168;
  const totalDays = totalHours / 24;
  const points: PricingCurvePoint[] = [];

  let exponent: number;
  switch (urgency) {
    case "ONE_DAY":
      exponent = 2.5;
      break;
    case "THREE_DAYS":
      exponent = 2.0;
      break;
    case "ONE_WEEK":
      exponent = 1.5;
      break;
    case "TWO_WEEKS":
      exponent = 1.3;
      break;
    case "ONE_MONTH":
      exponent = 1.1;
      break;
    case "NO_RUSH":
      exponent = 0.8;
      break;
    default:
      exponent = 1.5;
  }

  const steps = Math.min(Math.ceil(totalDays), 15);

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const day = Math.round(progress * totalDays);
    const decay = Math.pow(1 - progress, exponent);
    const price = Math.round(minPrice + (startPrice - minPrice) * decay);

    points.push({
      day,
      price: Math.max(price, minPrice),
      reason:
        progress === 0
          ? "Starting price"
          : progress < 0.3
            ? "Testing market response"
            : progress < 0.6
              ? "Competitive adjustment"
              : "Accelerating sale",
    });
  }

  return points;
}

// ──────────────────────────────────────────────
// OPTIMAL POSTING TIME
// ──────────────────────────────────────────────

function getOptimalPostingTimeClient(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  if (
    lower.includes("car") ||
    lower.includes("vehicle") ||
    lower.includes("transport")
  )
    return "🕐 Best time to post: Sunday evenings — car buyers are most active then";
  if (
    lower.includes("apartment") ||
    lower.includes("real estate") ||
    lower.includes("property")
  )
    return "🕐 Best time to post: Monday mornings — real estate searches peak then";
  if (
    lower.includes("electronic") ||
    lower.includes("phone") ||
    lower.includes("computer")
  )
    return "🕐 Best time to post: Thursday/Friday evenings — electronics shoppers browse then";
  if (lower.includes("fashion") || lower.includes("cloth"))
    return "🕐 Best time to post: Saturday mornings — fashion shoppers are most active";
  return "🕐 Best time to post: Sunday evenings — highest overall marketplace traffic";
}

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER (minimum price step)
// ──────────────────────────────────────────────

export async function handleAgentConfigInput(
  content: string,
  ctx: SellingStepContext,
) {
  let minP: number;

  if (content.toLowerCase().includes("no min")) {
    minP = Math.round(ctx.data.price * 0.5);
    ctx.updateData({ minimumPrice: minP });
  } else {
    const minNum = parseFloat(content.replace(/[€,\s]/g, ""));
    if (!isNaN(minNum) && minNum > 0) {
      minP = minNum;
      ctx.updateData({ minimumPrice: minP });
    } else {
      minP = Math.round(ctx.data.price * 0.7);
      ctx.updateData({ minimumPrice: minP });
    }
  }

  // Show default feedback if we defaulted
  const parsed = parseFloat(content.replace(/[€,\s]/g, ""));
  const wasDefault =
    !content.toLowerCase().includes("no min") && (isNaN(parsed) || parsed <= 0);
  const defaultNote = wasDefault
    ? ctx.t("minPriceDefault", { price: String(minP) })
    : "";

  // Automation config step — show toggles for auto-negotiate and auto-boost
  ctx.setCurrentStep("summary");
  await ctx.thinkAndRespond(
    ctx.t("minPriceSet", { price: String(minP), defaultNote }),
    [
      { label: ctx.t("autoBoth"), value: "auto_both" },
      { label: ctx.t("autoNegotiateOnly"), value: "auto_negotiate_only" },
      { label: ctx.t("autoBoostOnly"), value: "auto_boost_only" },
      { label: ctx.t("autoNone"), value: "auto_none" },
    ],
  );
}

// ──────────────────────────────────────────────
// STRATEGY SELECTION CONSTANTS
// ──────────────────────────────────────────────

export const SELLING_STRATEGY_OPTIONS = [
  {
    value: "SEALED_BID",
    icon: "🔒",
    label: "Sealed Bid",
    desc: "Blind offers — you pick the winner",
  },
  {
    value: "FIXED_PRICE",
    icon: "💲",
    label: "Fixed Price",
    desc: "Auto-accept at your price",
  },
  {
    value: "DUTCH_AUCTION",
    icon: "📉",
    label: "Dutch Auction",
    desc: "Price drops until someone buys",
  },
] as const;

/**
 * Handle strategy selection action from the wizard.
 * Called when user picks a selling strategy.
 */
export function handleStrategySelection(
  value: string,
  ctx: SellingStepContext,
) {
  const strategyId = value.replace("strategy_", "") as
    | "SEALED_BID"
    | "FIXED_PRICE"
    | "DUTCH_AUCTION";
  ctx.updateData({ sellingStrategyId: strategyId });
}

// ──────────────────────────────────────────────
// BUILD SELLING SUMMARY with price curve
// ──────────────────────────────────────────────

export function buildSellingSummary(ctx: SellingStepContext) {
  const minP = ctx.data.minimumPrice || Math.round(ctx.data.price * 0.7);
  const urgencyLabel =
    URGENCY_OPTIONS.find((u) => u.value === ctx.data.urgency)?.label ||
    "1 week";

  // Generate price curve for visualization
  const curve = generatePriceCurveClient(
    ctx.data.price,
    minP,
    ctx.data.urgency,
  );
  const postingTip = getOptimalPostingTimeClient(ctx.data.categoryName);

  // Build automation summary
  const autoFeatures: string[] = [];
  autoFeatures.push(ctx.t("strategyAutoRespond"));
  if (ctx.data.autoNegotiate) autoFeatures.push(ctx.t("strategyAutoNegotiate"));
  if (ctx.data.autoBoost) autoFeatures.push(ctx.t("strategyAutoBoost"));
  autoFeatures.push(ctx.t("strategyPriceAdjust"));
  autoFeatures.push(ctx.t("strategyAlerts"));

  ctx.addAgentMessage(
    ctx.t("summaryPlan", {
      title: ctx.data.title || "Your item",
      price: String(ctx.data.price),
      minPrice: String(minP),
      urgency: urgencyLabel,
      postingTip,
      features: autoFeatures.join("\n"),
    }),
    [
      { label: ctx.t("launchAgent"), value: "publish" },
      { label: ctx.t("saveDraft"), value: "draft" },
      { label: ctx.t("changeSomething"), value: "edit" },
    ],
    <PriceCurveVisualizer
      curve={curve}
      currentDay={0}
      startPrice={ctx.data.price}
      minPrice={minP}
      urgency={ctx.data.urgency}
      compact
    />,
  );
}
