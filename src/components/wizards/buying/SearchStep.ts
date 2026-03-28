import type { BuyingStepContext } from './types';
import { buildCategoryActions } from './types';

// ──────────────────────────────────────────────
// GREETING / DESCRIBE WANT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleSearchInput(content: string, ctx: BuyingStepContext) {
  ctx.updateData({ searchQuery: content });
  ctx.setCurrentStep('category');
  await ctx.thinkAndRespond(
    ctx.t('searchConfirm', { query: content }),
    buildCategoryActions(ctx.categories, content, ctx.locale),
  );
}
