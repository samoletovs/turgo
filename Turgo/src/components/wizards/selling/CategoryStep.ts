import type { SellingStepContext } from "./types";
import { resolveName, buildCategoryActions } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleCategoryInput(
  content: string,
  ctx: SellingStepContext,
) {
  // Try matching category name
  const lower = content.toLowerCase();
  let matchedCat = ctx.categories.find((c) => {
    const name = resolveName(c.name, ctx.locale, "");
    return (
      name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())
    );
  });

  // Also try matching subcategory names
  if (!matchedCat) {
    for (const cat of ctx.categories) {
      if (cat.children) {
        const childMatch = cat.children.find((ch) => {
          const name = resolveName(ch.name, ctx.locale, "");
          return (
            name.toLowerCase().includes(lower) ||
            lower.includes(name.toLowerCase())
          );
        });
        if (childMatch) {
          matchedCat = cat;
          break;
        }
      }
    }
  }

  if (matchedCat) {
    const catName = resolveName(matchedCat.name, ctx.locale, matchedCat.slug);
    ctx.updateData({ categoryId: matchedCat.id, categoryName: catName });
    ctx.setCurrentStep("pricing");
    await ctx.thinkAndRespond(ctx.t("categorySelected", { category: catName }));
  } else {
    // No match found — re-show category buttons sorted by relevance
    const itemText = `${ctx.data.title} ${ctx.data.description} ${content}`;
    await ctx.thinkAndRespond(
      ctx.t("categoryNotFound", { input: content }),
      buildCategoryActions(ctx.categories, itemText, ctx.locale),
    );
  }
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
  await ctx.thinkAndRespond(ctx.t("categorySelected", { category: catName }));
}
