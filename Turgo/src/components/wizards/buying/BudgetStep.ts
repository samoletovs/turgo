import type { BuyingStepContext } from "./types";
import { resolveName } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleBudgetInput(
  content: string,
  ctx: BuyingStepContext,
) {
  const numbers = content.match(/\d+/g)?.map(Number) || [];
  let parsedMax = 0;
  if (numbers.length >= 2) {
    parsedMax = Math.max(...numbers);
    const parsedIdeal = Math.min(...numbers);
    ctx.updateData({ maxPrice: parsedMax, idealPrice: parsedIdeal });
  } else if (numbers.length === 1) {
    parsedMax = numbers[0];
    ctx.updateData({
      maxPrice: parsedMax,
      idealPrice: Math.round(parsedMax * 0.7),
    });
  }

  // Try to fetch market data for context (cheap DB query, not AI)
  let marketInsight = "";
  if (ctx.data.categoryId && parsedMax > 0) {
    try {
      const market = await ctx.trpcUtils.ai.suggestPrice.fetch({
        categoryId: ctx.data.categoryId,
        title: ctx.data.searchQuery || "item",
        condition: ctx.data.condition || "USED",
        ...(ctx.data.locationId ? { locationId: ctx.data.locationId } : {}),
      });

      if (market.suggestedPrice > 0) {
        const coverage =
          market.maxPrice > 0
            ? Math.min(100, Math.round((parsedMax / market.maxPrice) * 100))
            : null;
        marketInsight =
          `\n\n📊 **Market insight:** Median price in this category is **€${market.suggestedPrice}** (range €${market.minPrice}–€${market.maxPrice})` +
          (coverage
            ? `\nYour budget of €${parsedMax} covers ~${coverage}% of listings.`
            : "") +
          (market.comparableListings
            ? ` Based on ${market.comparableListings} listings.`
            : "");
      }
    } catch {
      // Market data unavailable — continue without it
    }
  }

  ctx.setCurrentStep("location");
  await ctx.thinkAndRespond(
    `Budget set: up to **€${parsedMax}**${ctx.data.idealPrice ? ` (ideal: €${ctx.data.idealPrice})` : ""}${marketInsight}\n\nAny location preference?`,
    [
      ...ctx.locations.slice(0, 4).map((l) => ({
        label: resolveName(l.name, ctx.locale, l.slug),
        value: `loc_${l.id}`,
      })),
      { label: "🌍 Anywhere", value: "loc_any" },
    ],
  );
}
