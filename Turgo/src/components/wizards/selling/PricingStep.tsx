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
        content: `Your price: **€${priceNum}**\nAnalyzing market data...`,
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
      }
    } catch {
      // AI call failed — will use fallback
    }

    // Remove skeleton message
    ctx.setMessages((prev) => prev.filter((m) => m.id !== skeletonMsgId));
    ctx.setIsThinking(false);

    ctx.setCurrentStep("urgency");

    if (aiSuccess && suggested !== null) {
      ctx.updateData({ aiSuggestedPrice: suggested });
      const confidenceLabel =
        confidence >= 0.8 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
      ctx.addAgentMessage(
        `Your price: **€${priceNum}**\nMarket analysis suggests: **€${suggested}** (${confidenceLabel} confidence)${reasoning ? `\n\n💡 ${reasoning}` : ""}${comparableListings ? `\n📊 Based on ${comparableListings} comparable listings` : ""}\n\nNow, how quickly do you want to sell? This affects my pricing strategy:`,
        URGENCY_OPTIONS.map((u) => ({
          label: `${u.label}`,
          value: `urgency_${u.value}`,
        })),
      );
    } else {
      ctx.updateData({ aiSuggestedPrice: null });
      ctx.addAgentMessage(
        `Your price: **€${priceNum}**\n⚠️ AI pricing unavailable — I'll use your entered price.\n\nHow quickly do you want to sell? This affects my pricing strategy:`,
        URGENCY_OPTIONS.map((u) => ({
          label: `${u.label}`,
          value: `urgency_${u.value}`,
        })),
      );
    }
  } else {
    await ctx.thinkAndRespond(
      "I need a valid price in euros. Just type a number like 150 or 29.99",
    );
  }
}
