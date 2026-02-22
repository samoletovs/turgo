import type { BuyingStepContext } from "./types";
import { resolveName } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleCategoryInput(
  content: string,
  ctx: BuyingStepContext,
) {
  const matchedCat = ctx.categories.find((c) => {
    const name = resolveName(c.name, ctx.locale, "");
    return name.toLowerCase().includes(content.toLowerCase());
  });
  if (matchedCat) {
    const catName = resolveName(matchedCat.name, ctx.locale, matchedCat.slug);
    ctx.updateData({ categoryId: matchedCat.id, categoryName: catName });
  }
  ctx.setCurrentStep("budget");
  await ctx.thinkAndRespond(
    "What's your budget? Tell me:\n\n1. **Maximum** you'd pay\n2. **Ideal** price you'd love to pay\n\nFor example: \"max 500, ideal 350\"",
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (cat_*)
// ──────────────────────────────────────────────

export async function handleCategoryAction(
  value: string,
  ctx: BuyingStepContext,
) {
  const catId = value.replace("cat_", "");
  const cat = ctx.categories.find((c) => c.id === catId);
  const catName = cat ? resolveName(cat.name, ctx.locale, cat.slug) : "";
  ctx.updateData({ categoryId: catId, categoryName: catName });
  ctx.setCurrentStep("budget");
  await ctx.thinkAndRespond(
    "What's your budget?\n\nTell me the **maximum** you'd spend, and optionally your **ideal** price.\n\nExample: \"max 500, ideal 350\"",
  );
}
