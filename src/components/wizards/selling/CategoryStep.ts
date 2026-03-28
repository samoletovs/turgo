import type { SellingStepContext } from './types';
import { resolveName, buildCategoryActions } from './types';

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleCategoryInput(content: string, ctx: SellingStepContext) {
  // Try matching category name
  const lower = content.toLowerCase();
  let matchedCat = ctx.categories.find((c) => {
    const name = resolveName(c.name, ctx.locale, '');
    return name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase());
  });

  // Also try matching subcategory names
  if (!matchedCat) {
    for (const cat of ctx.categories) {
      if (cat.children) {
        const childMatch = cat.children.find((ch) => {
          const name = resolveName(ch.name, ctx.locale, '');
          return name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase());
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

    // If the matched category has subcategories, show them instead of advancing
    if (matchedCat.children && matchedCat.children.length > 0) {
      // Check if user typed a subcategory name directly
      const directSubMatch = matchedCat.children.find((ch) => {
        const name = resolveName(ch.name, ctx.locale, '');
        return name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase());
      });

      if (directSubMatch) {
        const subName = resolveName(directSubMatch.name, ctx.locale, directSubMatch.slug);
        ctx.updateData({
          categoryId: directSubMatch.id,
          categoryName: subName,
        });
        ctx.setCurrentStep('pricing');
        await ctx.thinkAndRespond(ctx.t('categorySelected', { category: subName }));
        return;
      }

      ctx.updateData({ categoryId: matchedCat.id, categoryName: catName });
      const subcatActions = matchedCat.children.map((ch) => ({
        label: resolveName(ch.name, ctx.locale, ch.slug),
        value: `subcat_${ch.id}`,
      }));
      await ctx.thinkAndRespond(ctx.t('pickSubcategory', { category: catName }), subcatActions);
      return;
    }

    ctx.updateData({ categoryId: matchedCat.id, categoryName: catName });
    ctx.setCurrentStep('pricing');
    await ctx.thinkAndRespond(ctx.t('categorySelected', { category: catName }));
  } else {
    // No match found — re-show category buttons sorted by relevance
    const itemText = `${ctx.data.title} ${ctx.data.description} ${content}`;
    await ctx.thinkAndRespond(
      ctx.t('categoryNotFound', { input: content }),
      buildCategoryActions(ctx.categories, itemText, ctx.locale),
    );
  }
}

// ──────────────────────────────────────────────
// ACTION HANDLER (cat_*)
// ──────────────────────────────────────────────

export async function handleCategoryAction(value: string, ctx: SellingStepContext) {
  const catId = value.replace('cat_', '');
  const cat = ctx.categories.find((c) => c.id === catId);
  const catName = cat ? resolveName(cat.name, ctx.locale, cat.slug) : '';

  // If the category has subcategories, ask the user to pick one
  if (cat?.children && cat.children.length > 0) {
    ctx.updateData({ categoryId: catId, categoryName: catName });
    const subcatActions = cat.children.map((ch) => ({
      label: resolveName(ch.name, ctx.locale, ch.slug),
      value: `subcat_${ch.id}`,
    }));
    await ctx.thinkAndRespond(ctx.t('pickSubcategory', { category: catName }), subcatActions);
    return;
  }

  ctx.updateData({ categoryId: catId, categoryName: catName });
  ctx.setCurrentStep('pricing');
  await ctx.thinkAndRespond(ctx.t('categorySelected', { category: catName }));
}

// ──────────────────────────────────────────────
// ACTION HANDLER (subcat_*)
// ──────────────────────────────────────────────

export async function handleSubcategoryAction(value: string, ctx: SellingStepContext) {
  const subId = value.replace('subcat_', '');
  // Find the subcategory across all categories
  let subName = '';
  for (const cat of ctx.categories) {
    const child = cat.children?.find((ch) => ch.id === subId);
    if (child) {
      subName = resolveName(child.name, ctx.locale, child.slug);
      break;
    }
  }
  ctx.updateData({ categoryId: subId, categoryName: subName });
  ctx.setCurrentStep('pricing');
  await ctx.thinkAndRespond(ctx.t('categorySelected', { category: subName }));
}
