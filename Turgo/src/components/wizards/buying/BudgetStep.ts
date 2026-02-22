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
  ctx.setCurrentStep("location");
  await ctx.thinkAndRespond(
    `Budget set: up to **€${parsedMax}**\n\nAny location preference?`,
    [
      ...ctx.locations.slice(0, 4).map((l) => ({
        label: resolveName(l.name, ctx.locale, l.slug),
        value: `loc_${l.id}`,
      })),
      { label: "🌍 Anywhere", value: "loc_any" },
    ],
  );
}
