import type { BuyingStepContext } from './types';
import { trpcClient } from '@/lib/trpc/client';
import type { StrategyRecommendation } from '@/types';

// ──────────────────────────────────────────────
// BUYING STRATEGY OPTIONS (used by wizard UI)
// Maps strategy IDs to i18n keys in buy.chat namespace
// ──────────────────────────────────────────────

export const BUYING_STRATEGY_OPTIONS = [
  { value: 'TIME_ESCALATION', icon: '⏳', i18nKey: 'strategyTimeEscalation' },
  { value: 'MAX_BID', icon: '💪', i18nKey: 'strategyMaxBid' },
  { value: 'SNIPER', icon: '🎯', i18nKey: 'strategySniper' },
  { value: 'ACCEPT_LISTED', icon: '✅', i18nKey: 'strategyAcceptListed' },
  { value: 'EARLY_BIRD', icon: '🐦', i18nKey: 'strategyEarlyBird' },
] as const;

/** Strategy labels for display in recommendation */
const STRATEGY_LABELS: Record<string, string> = {
  TIME_ESCALATION: 'Time Escalation',
  MAX_BID: 'Max Bid',
  SNIPER: 'Sniper',
  ACCEPT_LISTED: 'Accept Listed Price',
  EARLY_BIRD: 'Early Bird',
};

/**
 * Show buying strategy selection step with market-data-driven recommendation.
 * Fetches recommendation from the strategy recommender engine, pre-selects
 * the best strategy, and shows a market context card with reasoning.
 */
export async function showBuyingStrategySelection(ctx: BuyingStepContext) {
  ctx.setCurrentStep('strategy');

  // Try to fetch market-based recommendation
  let recommendation: StrategyRecommendation<string> | null = null;
  try {
    recommendation = await trpcClient.strategy.recommendBuying.query({
      categoryId: ctx.data.categoryId,
      locationId: ctx.data.locationId || undefined,
      maxBudget: ctx.data.maxPrice,
      targetPrice: ctx.data.idealPrice || undefined,
    });
  } catch {
    // Non-critical: fall back to showing all options without recommendation
  }

  if (recommendation) {
    // Pre-select recommended strategy
    ctx.updateData({
      buyingStrategyId: recommendation.strategyId as
        | 'TIME_ESCALATION'
        | 'MAX_BID'
        | 'SNIPER'
        | 'ACCEPT_LISTED'
        | 'EARLY_BIRD',
    });

    const recLabel = STRATEGY_LABELS[recommendation.strategyId] ?? recommendation.strategyId;
    const intro = ctx.t('strategyRecommendedIntro', {
      strategy: recLabel,
      confidence: recommendation.confidence,
    });
    const marketInfo = ctx.t('strategyMarketInfo', {
      listingCount: recommendation.marketContext.listingCount,
      medianPrice: Math.round(recommendation.marketContext.medianPrice),
      supply: recommendation.marketContext.supplyLevel,
      trend: recommendation.marketContext.priceTrend.direction,
    });

    await ctx.thinkAndRespond(
      `${intro}\n\n${marketInfo}\n\n${recommendation.reasoning}\n\n${ctx.t('strategyOverrideHint')}\n\n[${ctx.t('strategyLearnMore')}](/help#buyingStrategies)`,
      BUYING_STRATEGY_OPTIONS.map((s) => ({
        label: s.value === recommendation!.strategyId ? `⭐ ${ctx.t(s.i18nKey)}` : ctx.t(s.i18nKey),
        value: `strategy_${s.value}`,
      })),
    );
  } else {
    // No market data available — show plain selection
    await ctx.thinkAndRespond(
      ctx.t('chooseBuyingStrategy') +
        '\n\n[' +
        ctx.t('strategyLearnMore') +
        '](/help#buyingStrategies)',
      BUYING_STRATEGY_OPTIONS.map((s) => ({
        label: ctx.t(s.i18nKey),
        value: `strategy_${s.value}`,
      })),
    );
  }
}

/**
 * Handle strategy selection action from the wizard.
 * Sets the strategy and advances to agent_proposal step.
 */
export function handleBuyingStrategyAction(value: string, ctx: BuyingStepContext) {
  const strategyId = value.replace('strategy_', '') as
    | 'TIME_ESCALATION'
    | 'MAX_BID'
    | 'SNIPER'
    | 'ACCEPT_LISTED'
    | 'EARLY_BIRD';
  ctx.updateData({ buyingStrategyId: strategyId });
}
