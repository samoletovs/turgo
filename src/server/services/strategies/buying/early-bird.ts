/**
 * Early-Bird Buying Strategy
 *
 * Bids early in a listing's lifecycle at 60–70% of the listed price.
 * The idea: get in while competition is low and secure a bargain.
 *
 * - Targets the first 40% of the listing's time window
 * - Offer percentage starts at ~60% and creeps up toward 70% as the
 *   window progresses, rewarding patience without missing the boat
 * - Does NOT escalate — this is a one-shot "take it or leave it" style
 * - Best paired with sellers using SEALED_BID (no counter-offers)
 *   or FIXED_PRICE (seller either accepts the discount or doesn't)
 */

import type {
  BuyingStrategy,
  BuyingAgentContext,
  ListingContext,
  BidDecision,
  EscalateDecision,
  OfferContext,
} from '../types';

/** Only bid on listings with at least this deal score */
const MIN_DEAL_SCORE = 35;

/** Bid range as fraction of listing price */
const LOW_FACTOR = 0.6;
const HIGH_FACTOR = 0.7;

/** Only bid while listing progress is below this threshold (0–1) */
const DEFAULT_ACTIVITY_WINDOW = 0.4;

/**
 * Resolve the activity window from agent.strategyConfig,
 * falling back to the default.
 */
function getActivityWindow(agent: BuyingAgentContext): number {
  const raw = (agent.strategyConfig as Record<string, unknown> | null)?.activityWindow;
  if (typeof raw === 'number' && raw > 0 && raw <= 1) return raw;
  return DEFAULT_ACTIVITY_WINDOW;
}

/**
 * Calculate how far through its lifecycle a listing is (0 → 1).
 * Returns 0.5 if no expiry is set (middle-of-the-road assumption).
 */
function getListingProgress(listing: ListingContext): number {
  if (!listing.expiresAt) return 0.5;
  const total = listing.expiresAt.getTime() - listing.createdAt.getTime();
  if (total <= 0) return 1;
  const elapsed = Date.now() - listing.createdAt.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}

export const earlyBirdStrategy: BuyingStrategy = {
  id: 'EARLY_BIRD',
  nameKey: 'strategy.buying.early_bird.name',
  descriptionKey: 'strategy.buying.early_bird.description',

  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null {
    if (dealScore < MIN_DEAL_SCORE) return null;

    const progress = getListingProgress(listing);
    const window = getActivityWindow(agent);

    // Only bid in the early portion of the listing's lifecycle
    if (progress > window) {
      return null;
    }

    // Interpolate: at progress=0 we bid LOW_FACTOR, at progress=window we bid HIGH_FACTOR
    const t = window > 0 ? progress / window : 0;
    const factor = LOW_FACTOR + t * (HIGH_FACTOR - LOW_FACTOR);

    const bidPrice = Math.round(listing.currentPrice * factor);

    // Never exceed budget
    if (bidPrice > agent.maxBudget) return null;

    // If target price is set and the bid would be above it, cap at target
    const finalPrice =
      agent.targetPrice && bidPrice > agent.targetPrice ? agent.targetPrice : bidPrice;

    if (finalPrice <= 0) return null;

    return {
      price: finalPrice,
      reasoning:
        `Early-bird: Bidding €${finalPrice} (${(factor * 100).toFixed(0)}% of ` +
        `€${listing.currentPrice}) at ${(progress * 100).toFixed(0)}% listing ` +
        `progress (window: ${(window * 100).toFixed(0)}%).`,
    };
  },

  shouldEscalate(
    _agent: BuyingAgentContext,
    _listing: ListingContext,
    _currentOffer: OfferContext,
  ): EscalateDecision | null {
    // Early-bird is a one-shot strategy — no escalation
    return {
      shouldEscalate: false,
      reasoning: 'Early-bird strategy does not escalate. One-shot bid only.',
    };
  },
};
