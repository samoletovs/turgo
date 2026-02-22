import type { SellingStepContext } from "./types";
import { URGENCY_OPTIONS } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleAgentConfigInput(
  content: string,
  ctx: SellingStepContext,
) {
  if (content.toLowerCase().includes("no min")) {
    ctx.updateData({ minimumPrice: Math.round(ctx.data.price * 0.5) });
  } else {
    const minNum = parseFloat(content.replace(/[€,\s]/g, ""));
    if (!isNaN(minNum) && minNum > 0) {
      ctx.updateData({ minimumPrice: minNum });
    } else {
      ctx.updateData({ minimumPrice: Math.round(ctx.data.price * 0.7) });
    }
  }
  ctx.setCurrentStep("summary");
  const minP = ctx.data.minimumPrice || Math.round(ctx.data.price * 0.7);
  await ctx.thinkAndRespond(
    `Here's my plan:\n\n🏷️ **${ctx.data.title || "Your item"}**\n💰 Starting at **€${ctx.data.price}** → minimum **€${minP}**\n⏱️ ${URGENCY_OPTIONS.find((u) => u.value === ctx.data.urgency)?.label || "1 week"}\n\n**My strategy:**\n• Start at your price to test the market\n• Auto-respond to buyer questions 24/7\n• Dynamically adjust price based on engagement\n• Alert you when offers come in\n\nReady to go live?`,
    [
      { label: "🚀 Launch agent!", value: "publish" },
      { label: "📝 Save as draft", value: "draft" },
      { label: "🔙 Change something", value: "edit" },
    ],
  );
}
