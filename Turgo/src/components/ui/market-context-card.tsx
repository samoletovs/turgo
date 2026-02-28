"use client";

import type { MarketContext } from "@/types";

interface MarketContextCardProps {
  context: MarketContext;
  /** Recommended strategy label to highlight */
  recommendedLabel?: string;
  /** Confidence percentage 0-100 */
  confidence?: number;
  /** Human-readable reasoning */
  reasoning?: string;
}

const TREND_ICONS: Record<string, string> = {
  rising: "📈",
  falling: "📉",
  stable: "➡️",
};

const SUPPLY_ICONS: Record<string, string> = {
  high: "📦",
  moderate: "📋",
  low: "💎",
};

const SPREAD_LABELS: Record<string, string> = {
  wide: "Wide range",
  moderate: "Moderate range",
  tight: "Tight range",
};

/**
 * Compact market context card for wizard strategy selection.
 * Shows supply level, price trend, median price, listing count.
 */
export function MarketContextCard({
  context,
  recommendedLabel,
  confidence,
  reasoning,
}: MarketContextCardProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">📊</span>
        <span className="font-medium text-blue-900 dark:text-blue-100">
          Market Analysis
        </span>
        {context.subcategorySlug && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {context.subcategorySlug}
          </span>
        )}
      </div>

      {/* Signal grid */}
      <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>{SUPPLY_ICONS[context.supplyLevel]}</span>
          <span>
            Supply:{" "}
            <span className="font-medium text-foreground">
              {context.supplyLevel} ({context.listingCount})
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>{TREND_ICONS[context.priceTrend.direction]}</span>
          <span>
            Trend:{" "}
            <span className="font-medium text-foreground">
              {context.priceTrend.direction}
              {context.priceTrend.velocityPerWeek !== 0 &&
                ` (${context.priceTrend.velocityPerWeek > 0 ? "+" : ""}${context.priceTrend.velocityPerWeek}%/wk)`}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>💰</span>
          <span>
            Median:{" "}
            <span className="font-medium text-foreground">
              €{context.medianPrice.toFixed(0)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>📐</span>
          <span>
            Prices:{" "}
            <span className="font-medium text-foreground">
              {SPREAD_LABELS[context.priceSpread]}
            </span>
          </span>
        </div>
        {context.avgDaysToSell !== null && (
          <div className="flex items-center gap-1">
            <span>⏱️</span>
            <span>
              Avg time:{" "}
              <span className="font-medium text-foreground">
                {context.avgDaysToSell}d
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {reasoning && (
        <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
          {reasoning}
        </p>
      )}

      {recommendedLabel && confidence !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            ⭐ Recommended: {recommendedLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {confidence}% confidence
          </span>
        </div>
      )}
    </div>
  );
}
