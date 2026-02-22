import type { SellingStepContext } from "./types";
import { resolveName } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleCategoryInput(
  content: string,
  ctx: SellingStepContext,
) {
  const matchedCat = ctx.categories.find((c) => {
    const name = resolveName(c.name, ctx.locale, "");
    return name.toLowerCase().includes(content.toLowerCase());
  });
  if (matchedCat) {
    const catName = resolveName(matchedCat.name, ctx.locale, matchedCat.slug);
    ctx.updateData({ categoryId: matchedCat.id, categoryName: catName });
  }
  ctx.setCurrentStep("pricing");
  await ctx.thinkAndRespond(
    "What price are you thinking? I'll analyze the market and suggest an optimal starting price.\n\nJust type a number (in EUR).",
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (cat_*)
// ──────────────────────────────────────────────

export async function handleCategoryAction(
  value: string,
  ctx: SellingStepContext,
) {
  const catId = value.replace("cat_", "");
  const cat = ctx.categories.find((c) => c.id === catId);
  const catName = cat ? resolveName(cat.name, ctx.locale, cat.slug) : "";
  ctx.updateData({ categoryId: catId, categoryName: catName });
  ctx.setCurrentStep("pricing");
  await ctx.thinkAndRespond(
    `${catName} — great choice!\n\nWhat price did you have in mind? I'll compare against market data and suggest an optimal starting price.\n\nJust type a number (EUR).`,
  );
}
