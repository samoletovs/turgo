import type { BuyingStepContext } from './types';
import { CONDITION_OPTIONS, resolveName } from './types';

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleLocationInput(content: string, ctx: BuyingStepContext) {
  const lower = content.toLowerCase().trim();

  // Check for "anywhere" intent
  if (
    lower.includes('anywhere') ||
    lower.includes('any') ||
    lower.includes('all') ||
    lower.includes("doesn't matter") ||
    lower.includes('no preference')
  ) {
    ctx.updateData({ locationName: 'Anywhere' });
  } else {
    // Fuzzy match against available locations
    const matchedLoc = ctx.locations.find((l) => {
      const name = resolveName(l.name, ctx.locale, l.slug);
      return name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase());
    });
    if (matchedLoc) {
      const locName = resolveName(matchedLoc.name, ctx.locale, matchedLoc.slug);
      ctx.updateData({ locationId: matchedLoc.id, locationName: locName });
    } else {
      // No match — store as location name for reference
      ctx.updateData({ locationName: content.trim() });
    }
  }

  ctx.setCurrentStep('condition');
  await ctx.thinkAndRespond(
    ctx.t('conditionPrompt'),
    CONDITION_OPTIONS.map((c) => ({
      label: `${c.label} — ${c.desc}`,
      value: `cond_${c.value}`,
    })),
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (loc_*)
// ──────────────────────────────────────────────

export async function handleLocationAction(value: string, ctx: BuyingStepContext) {
  if (value === 'loc_any') {
    ctx.updateData({ locationName: 'Anywhere' });
  } else {
    const locId = value.replace('loc_', '');
    const loc = ctx.locations.find((l) => l.id === locId);
    const locName = loc ? resolveName(loc.name, ctx.locale, loc.slug) : '';
    ctx.updateData({ locationId: locId, locationName: locName });
  }
  ctx.setCurrentStep('condition');
  await ctx.thinkAndRespond(
    ctx.t('conditionPrompt'),
    CONDITION_OPTIONS.map((c) => ({
      label: `${c.label} — ${c.desc}`,
      value: `cond_${c.value}`,
    })),
  );
}
