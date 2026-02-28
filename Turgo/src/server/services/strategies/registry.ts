/**
 * Strategy Registry — Maps strategy IDs → implementations.
 * Single source of truth for all available strategies.
 */

import type { SellingStrategyId, BuyingStrategyId } from "@prisma/client";
import type {
  SellingStrategy,
  BuyingStrategy,
  SellingStrategyMeta,
  BuyingStrategyMeta,
} from "./types";

// ── Selling strategies ───────────────────────
import { sealedBidStrategy } from "./selling/sealed-bid";
import { fixedPriceStrategy } from "./selling/fixed-price";
import { dutchAuctionStrategy } from "./selling/dutch-auction";

// ── Buying strategies ────────────────────────
import { timeEscalationStrategy } from "./buying/time-escalation";
import { maxBidStrategy } from "./buying/max-bid";
import { sniperStrategy } from "./buying/sniper";
import { acceptListedStrategy } from "./buying/accept-listed";
import { earlyBirdStrategy } from "./buying/early-bird";

// ──────────────────────────────────────────────
// REGISTRIES
// ──────────────────────────────────────────────

const sellingStrategies: Record<SellingStrategyId, SellingStrategy> = {
  SEALED_BID: sealedBidStrategy,
  FIXED_PRICE: fixedPriceStrategy,
  DUTCH_AUCTION: dutchAuctionStrategy,
};

const buyingStrategies: Record<BuyingStrategyId, BuyingStrategy> = {
  TIME_ESCALATION: timeEscalationStrategy,
  MAX_BID: maxBidStrategy,
  SNIPER: sniperStrategy,
  ACCEPT_LISTED: acceptListedStrategy,
  EARLY_BIRD: earlyBirdStrategy,
};

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────

export function getSellingStrategy(id: SellingStrategyId): SellingStrategy {
  const strategy = sellingStrategies[id];
  if (!strategy) throw new Error(`Unknown selling strategy: ${id}`);
  return strategy;
}

export function getBuyingStrategy(id: BuyingStrategyId): BuyingStrategy {
  const strategy = buyingStrategies[id];
  if (!strategy) throw new Error(`Unknown buying strategy: ${id}`);
  return strategy;
}

/** All selling strategy metadata for wizard UI */
export function getSellingStrategyMetas(): SellingStrategyMeta[] {
  return [
    {
      id: "SEALED_BID",
      nameKey: "strategy.selling.sealed_bid.name",
      descriptionKey: "strategy.selling.sealed_bid.description",
      requiredPlan: "FREE",
      requiresAutoNegotiate: false,
    },
    {
      id: "FIXED_PRICE",
      nameKey: "strategy.selling.fixed_price.name",
      descriptionKey: "strategy.selling.fixed_price.description",
      requiredPlan: "FREE",
      requiresAutoNegotiate: false,
    },
    {
      id: "DUTCH_AUCTION",
      nameKey: "strategy.selling.dutch_auction.name",
      descriptionKey: "strategy.selling.dutch_auction.description",
      requiredPlan: "PRO",
      requiresAutoNegotiate: true,
    },
  ];
}

/** All buying strategy metadata for wizard UI */
export function getBuyingStrategyMetas(): BuyingStrategyMeta[] {
  return [
    {
      id: "TIME_ESCALATION",
      nameKey: "strategy.buying.time_escalation.name",
      descriptionKey: "strategy.buying.time_escalation.description",
      requiredPlan: "PRO",
      requiresAutoNegotiate: true,
    },
    {
      id: "MAX_BID",
      nameKey: "strategy.buying.max_bid.name",
      descriptionKey: "strategy.buying.max_bid.description",
      requiredPlan: "PRO",
      requiresAutoNegotiate: true,
    },
    {
      id: "SNIPER",
      nameKey: "strategy.buying.sniper.name",
      descriptionKey: "strategy.buying.sniper.description",
      requiredPlan: "BUSINESS",
      requiresAutoNegotiate: true,
    },
    {
      id: "ACCEPT_LISTED",
      nameKey: "strategy.buying.accept_listed.name",
      descriptionKey: "strategy.buying.accept_listed.description",
      requiredPlan: "FREE",
      requiresAutoNegotiate: false,
    },
    {
      id: "EARLY_BIRD",
      nameKey: "strategy.buying.early_bird.name",
      descriptionKey: "strategy.buying.early_bird.description",
      requiredPlan: "FREE",
      requiresAutoNegotiate: true,
    },
  ];
}
