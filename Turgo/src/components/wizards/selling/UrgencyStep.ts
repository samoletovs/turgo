import type { SellingStepContext } from "./types";
import { URGENCY_OPTIONS } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleUrgencyInput(
  content: string,
  ctx: SellingStepContext,
) {
  // Try to match urgency from text
  const urgencyMatch = URGENCY_OPTIONS.find((u) =>
    content
      .toLowerCase()
      .includes(u.label.toLowerCase().replace("within ", "")),
  );
  if (urgencyMatch) {
    ctx.updateData({ urgency: urgencyMatch.value });
  }
  ctx.setCurrentStep("agent_config");
  await ctx.thinkAndRespond(
    `I'll base my pricing strategy on that timeline.\n\nNow, what's the absolute **minimum price** you'd accept? I won't go below this, even under deadline pressure.\n\nType a number (EUR), or say "no minimum" if price is flexible.`,
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (urgency_*)
// ──────────────────────────────────────────────

export async function handleUrgencyAction(
  value: string,
  ctx: SellingStepContext,
) {
  const urgencyVal = value.replace("urgency_", "");
  const urgency = URGENCY_OPTIONS.find((u) => u.value === urgencyVal);
  ctx.updateData({ urgency: urgencyVal });
  ctx.setCurrentStep("agent_config");
  await ctx.thinkAndRespond(
    `**${urgency?.label}** — ${urgency?.desc}.\n\nNow, what's the absolute **minimum price** you'd accept? I'll never go below this.\n\nType a number (EUR).`,
  );
}
