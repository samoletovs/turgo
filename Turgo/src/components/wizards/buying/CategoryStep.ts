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
  await ctx.thinkAndRespond(ctx.t("budgetPrompt"));
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
  await ctx.thinkAndRespond(ctx.t("budgetPrompt"));
}
