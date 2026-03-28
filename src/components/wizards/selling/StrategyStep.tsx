import type { SellingStepContext } from './types';
import { trpcClient } from '@/lib/trpc/client';
import type { StrategyRecommendation, MarketContext } from '@/types';

// ──────────────────────────────────────────────
// SELLING STRATEGY OPTIONS (used by wizard UI)
// Maps strategy IDs to i18n keys in sell.chat namespace
// ──────────────────────────────────────────────

export const SELLING_STRATEGY_OPTIONS = [
  { value: 'SEALED_BID', icon: '🔒', i18nKey: 'strategySealedBid' },
  { value: 'FIXED_PRICE', icon: '💲', i18nKey: 'strategyFixedPrice' },
  { value: 'DUTCH_AUCTION', icon: '📉', i18nKey: 'strategyDutchAuction' },
] as const;

/** Strategy labels for display in recommendation */
const STRATEGY_LABELS: Record<string, string> = {
  SEALED_BID: 'Sealed Bid',
  FIXED_PRICE: 'Fixed Price',
  DUTCH_AUCTION: 'Dutch Auction',
};

/**
 * Show strategy selection step with market-data-driven recommendation.
 * Fetches recommendation from the strategy recommender engine, pre-selects
 * the best strategy, and shows a market context card with reasoning.
 */
export async function showSellingStrategySelection(ctx: SellingStepContext) {
  ctx.setCurrentStep('strategy');

  // Try to fetch market-based recommendation
  let recommendation: StrategyRecommendation<string> | null = null;
  try {
    recommendation = await trpcClient.strategy.recommendSelling.query({
      categoryId: ctx.data.categoryId,
      locationId: ctx.data.locationId || undefined,
      urgency: ctx.data.urgency,
      price: ctx.data.price,
      minimumPrice: ctx.data.minimumPrice,
    });
  } catch {
    // Non-critical: fall back to showing all options without recommendation
  }

  if (recommendation) {
    // Pre-select recommended strategy
    ctx.updateData({
      sellingStrategyId: recommendation.strategyId as
        | 'SEALED_BID'
        | 'FIXED_PRICE'
        | 'DUTCH_AUCTION',
    });

    // Show recommendation message with market context
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
      `${intro}\n\n${marketInfo}\n\n${recommendation.reasoning}\n\n${ctx.t('strategyOverrideHint')}`,
      SELLING_STRATEGY_OPTIONS.map((s) => ({
        label: s.value === recommendation!.strategyId ? `⭐ ${ctx.t(s.i18nKey)}` : ctx.t(s.i18nKey),
        value: `strategy_${s.value}`,
      })),
    );
  } else {
    // No market data available — show plain selection
    await ctx.thinkAndRespond(
      ctx.t('chooseSellingStrategy'),
      SELLING_STRATEGY_OPTIONS.map((s) => ({
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
export function handleSellingStrategyAction(value: string, ctx: SellingStepContext) {
  const strategyId = value.replace('strategy_', '') as
    | 'SEALED_BID'
    | 'FIXED_PRICE'
    | 'DUTCH_AUCTION';
  ctx.updateData({ sellingStrategyId: strategyId });
}
