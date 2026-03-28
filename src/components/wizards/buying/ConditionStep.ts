import type { BuyingStepContext } from './types';
import { MONITOR_FREQ } from './types';

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleConditionInput(content: string, ctx: BuyingStepContext) {
  const lower = content.toLowerCase().trim();

  // Parse condition from free text
  if (lower.includes('new') && !lower.includes('used') && !lower.includes('any')) {
    ctx.updateData({ condition: 'NEW' });
  } else if (lower.includes('used') || lower.includes('second')) {
    ctx.updateData({ condition: 'USED' });
  } else if (
    lower.includes('any') ||
    lower.includes("doesn't matter") ||
    lower.includes('both') ||
    lower.includes('either')
  ) {
    ctx.updateData({ condition: 'ANY' });
  }
  // If no match, keep the default "ANY"

  ctx.setCurrentStep('agent_config');
  await ctx.thinkAndRespond(
    ctx.t('frequencyPrompt'),
    MONITOR_FREQ.map((f) => ({
      label: `${f.label} — ${f.desc}`,
      value: `freq_${f.value}`,
    })),
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (cond_*)
// ──────────────────────────────────────────────

export async function handleConditionAction(value: string, ctx: BuyingStepContext) {
  ctx.updateData({ condition: value.replace('cond_', '') });
  ctx.setCurrentStep('agent_config');
  await ctx.thinkAndRespond(
    ctx.t('frequencyPrompt'),
    MONITOR_FREQ.map((f) => ({
      label: `${f.label} — ${f.desc}`,
      value: `freq_${f.value}`,
    })),
  );
}
