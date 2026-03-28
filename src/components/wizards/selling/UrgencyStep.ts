import type { SellingStepContext } from './types';
import { URGENCY_OPTIONS } from './types';

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleUrgencyInput(content: string, ctx: SellingStepContext) {
  // Try to match urgency from text
  const urgencyMatch = URGENCY_OPTIONS.find((u) =>
    content.toLowerCase().includes(u.label.toLowerCase().replace('within ', '')),
  );
  if (urgencyMatch) {
    ctx.updateData({ urgency: urgencyMatch.value });
  }
  ctx.setCurrentStep('agent_config');
  await ctx.thinkAndRespond(ctx.t('urgencyFromText'));
}

// ──────────────────────────────────────────────
// ACTION HANDLER (urgency_*)
// ──────────────────────────────────────────────

export async function handleUrgencyAction(value: string, ctx: SellingStepContext) {
  const urgencyVal = value.replace('urgency_', '');
  const urgency = URGENCY_OPTIONS.find((u) => u.value === urgencyVal);
  ctx.updateData({ urgency: urgencyVal });
  ctx.setCurrentStep('agent_config');
  await ctx.thinkAndRespond(
    ctx.t('urgencySelected', {
      label: urgency?.label || urgencyVal,
      desc: urgency?.desc || '',
    }),
  );
}
