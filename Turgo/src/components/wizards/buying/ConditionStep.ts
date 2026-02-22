import type { BuyingStepContext } from "./types";
import { MONITOR_FREQ } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleConditionInput(
  content: string,
  ctx: BuyingStepContext,
) {
  ctx.setCurrentStep("agent_config");
  await ctx.thinkAndRespond(
    "How often should I check for new listings?\n\nThe more frequently I check, the faster you'll know about new deals.",
    MONITOR_FREQ.map((f) => ({
      label: `${f.label} — ${f.desc}`,
      value: `freq_${f.value}`,
    })),
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (cond_*)
// ──────────────────────────────────────────────

export async function handleConditionAction(
  value: string,
  ctx: BuyingStepContext,
) {
  ctx.updateData({ condition: value.replace("cond_", "") });
  ctx.setCurrentStep("agent_config");
  await ctx.thinkAndRespond(
    "How often should I check for new listings?",
    MONITOR_FREQ.map((f) => ({
      label: `${f.label} — ${f.desc}`,
      value: `freq_${f.value}`,
    })),
  );
}
