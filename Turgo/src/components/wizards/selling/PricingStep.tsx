import { TrendingUp } from "lucide-react";
import type { SellingStepContext } from "./types";
import { URGENCY_OPTIONS } from "./types";

// ──────────────────────────────────────────────
// PRICING SKELETON
// ──────────────────────────────────────────────

export function PricingSkeleton() {
  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs text-muted-foreground">
          Analyzing market data...
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted-foreground/20" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handlePricingInput(
  content: string,
  ctx: SellingStepContext,
) {
  const priceNum = parseFloat(content.replace(/[€,\s]/g, ""));
  if (!isNaN(priceNum) && priceNum > 0) {
    ctx.updateData({ price: priceNum });

    // Show pricing analysis skeleton while AI works
    const skeletonMsgId = `pricing-skeleton-${Date.now()}`;
    ctx.setMessages((prev) => [
      ...prev,
      {
        id: skeletonMsgId,
        role: "agent" as const,
        content: `${ctx.t("priceYours", { price: String(priceNum) })}\n${ctx.t("analyzing")}`,
        timestamp: new Date(),
        component: <PricingSkeleton />,
      },
    ]);
    ctx.setIsThinking(true);

    let suggested: number | null = null;
    let reasoning = "";
    let confidence = 0;
    let comparableListings = 0;
    let aiSuccess = false;
    let noDataReason = "";

    try {
      const result = await ctx.trpcUtils.ai.suggestPrice.fetch({
        categoryId: ctx.data.categoryId,
        title: ctx.data.title || content,
        condition: ctx.data.condition,
        ...(ctx.data.locationId ? { locationId: ctx.data.locationId } : {}),
      });

      if (result.suggestedPrice > 0) {
        suggested = result.suggestedPrice;
        reasoning = result.reasoning;
        confidence = result.confidence;
        comparableListings = result.comparableListings;
        aiSuccess = true;
      } else {
        // Server returned 0 — capture the reason
        noDataReason = result.reasoning || "";
      }
    } catch {
      // Network/auth error
      noDataReason =
        "Could not connect to the pricing service. Please check your connection and try again.";
    }

    // Remove skeleton message
    ctx.setMessages((prev) => prev.filter((m) => m.id !== skeletonMsgId));
    ctx.setIsThinking(false);

    if (aiSuccess && suggested !== null && suggested !== priceNum) {
      ctx.updateData({ aiSuggestedPrice: suggested });
      const confidenceLabel =
        confidence >= 0.8 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
      const confidenceColor =
        confidence >= 0.8 ? "🟢" : confidence >= 0.5 ? "🟡" : "🔴";

      // Show price comparison with actionable buttons
      ctx.addAgentMessage(
        ctx.t("priceSuggestion", {
          price: String(priceNum),
          confidence: confidenceColor,
          suggested: String(suggested),
          confidenceLabel,
          reasoning: reasoning ? `\n\n💡 ${reasoning}` : "",
          comparable: comparableListings
            ? `\n📊 Based on ${comparableListings} comparable listings`
            : "",
        }),
        [
          {
            label: ctx.t("useAiPrice", { price: String(suggested) }),
            value: `use_ai_price_${suggested}`,
          },
          {
            label: ctx.t("keepMyPrice", { price: String(priceNum) }),
            value: "keep_my_price",
          },
        ],
      );
    } else {
      ctx.updateData({ aiSuggestedPrice: null });
      ctx.setCurrentStep("urgency");

      // Build an informative explanation for why pricing data isn't available
      const explanation = noDataReason
        ? `\n\n📊 ${noDataReason}`
        : aiSuccess
          ? ""
          : `\n\n📊 I don't have enough market data for "${ctx.data.categoryName || "this category"}" yet. As more listings are added, pricing suggestions will become available.`;

      ctx.addAgentMessage(
        aiSuccess
          ? ctx.t("priceMatch", { price: String(priceNum) })
          : `Your price: **€${priceNum}** — noted! ✅${explanation}\n\nHow quickly do you want to sell? This affects my pricing strategy:`,
        URGENCY_OPTIONS.map((u) => ({
          label: `${u.label}`,
          value: `urgency_${u.value}`,
        })),
      );
    }
  } else {
    await ctx.thinkAndRespond(ctx.t("invalidPrice"));
  }
}
