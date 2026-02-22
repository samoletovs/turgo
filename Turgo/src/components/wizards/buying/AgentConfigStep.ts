import type { BuyingStepContext } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleAgentConfigInput(
  content: string,
  ctx: BuyingStepContext,
) {
  ctx.setCurrentStep("summary");
  await buildBuyingSummary(ctx);
}

// ──────────────────────────────────────────────
// BUILD SUMMARY
// ──────────────────────────────────────────────

export async function buildBuyingSummary(ctx: BuyingStepContext) {
  await ctx.thinkAndRespond(
    `Here's my monitoring plan:\n\n🔍 **Looking for:** ${ctx.data.searchQuery || "Your item"}\n📂 **Category:** ${ctx.data.categoryName || "All"}\n💰 **Budget:** €${ctx.data.idealPrice}–€${ctx.data.maxPrice}\n📍 **Location:** ${ctx.data.locationName || "Anywhere"}\n📊 **Condition:** ${ctx.data.condition === "ANY" ? "Any" : ctx.data.condition}\n⏱️ **Checking:** Every ${ctx.data.monitorFrequency} min\n\n**I will:**\n• Scan every new listing matching your criteria\n• Score each deal (0–100) based on 7 factors\n• Alert you instantly for deals scoring 70+\n• Track price drops on matching listings\n\nShall I start monitoring?`,
    [
      { label: "🚀 Start monitoring!", value: "create_agent" },
      { label: "📝 Adjust criteria", value: "edit" },
    ],
  );
}
