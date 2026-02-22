import type { BuyingStepContext } from "./types";
import { CONDITION_OPTIONS, resolveName } from "./types";

// ──────────────────────────────────────────────
// TEXT INPUT HANDLER
// ──────────────────────────────────────────────

export async function handleLocationInput(
  content: string,
  ctx: BuyingStepContext,
) {
  ctx.setCurrentStep("condition");
  await ctx.thinkAndRespond(
    "What condition are you okay with?",
    CONDITION_OPTIONS.map((c) => ({
      label: `${c.label} — ${c.desc}`,
      value: `cond_${c.value}`,
    })),
  );
}

// ──────────────────────────────────────────────
// ACTION HANDLER (loc_*)
// ──────────────────────────────────────────────

export async function handleLocationAction(
  value: string,
  ctx: BuyingStepContext,
) {
  if (value === "loc_any") {
    ctx.updateData({ locationName: "Anywhere" });
  } else {
    const locId = value.replace("loc_", "");
    const loc = ctx.locations.find((l) => l.id === locId);
    const locName = loc ? resolveName(loc.name, ctx.locale, loc.slug) : "";
    ctx.updateData({ locationId: locId, locationName: locName });
  }
  ctx.setCurrentStep("condition");
  await ctx.thinkAndRespond(
    "What condition are you okay with?",
    CONDITION_OPTIONS.map((c) => ({
      label: `${c.label} — ${c.desc}`,
      value: `cond_${c.value}`,
    })),
  );
}
