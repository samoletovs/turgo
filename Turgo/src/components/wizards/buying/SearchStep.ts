import type { BuyingStepContext } from "./types";
import { resolveName } from "./types";

// ──────────────────────────────────────────────
// GREETING / DESCRIBE WANT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleSearchInput(
  content: string,
  ctx: BuyingStepContext,
) {
  ctx.updateData({ searchQuery: content });
  ctx.setCurrentStep("category");
  await ctx.thinkAndRespond(
    `Got it — searching for: "${content}"\n\nWhich category should I focus on?`,
    ctx.categories.slice(0, 6).map((c) => {
      const name = resolveName(c.name, ctx.locale, c.slug);
      return { label: name, value: `cat_${c.id}` };
    }),
  );
}
