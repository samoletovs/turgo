/**
 * Sniper Buying Strategy
 *
 * Waits until the listing passes its activation threshold (default 50%
 * of lifetime), then bids aggressively. Designed to catch sellers who
 * are getting anxious as their deadline approaches.
 *
 * - Does nothing for the first half (or custom window) of the listing's life
 * - Bids at 85-95% of max budget once the snipe window opens
 * - Only one shot — no escalation after the snipe
 *
 * The activation threshold is configurable via strategyConfig:
 *   { activationThreshold: 0.3–0.9 }  (default 0.50)
 */

import type {
  BuyingStrategy,
  BuyingAgentContext,
  ListingContext,
  BidDecision,
  EscalateDecision,
  OfferContext,
} from '../types';
import { URGENCY_HOURS } from '@/lib/constants';

/** Default snipe window: last 50% of listing lifetime */
const DEFAULT_SNIPE_THRESHOLD = 0.5;

/** Sniper discount: bid at 85-95% of max budget */
const SNIPE_MIN_RATIO = 0.85;
const SNIPE_MAX_RATIO = 0.95;

/** Minimum deal score to trigger a snipe */
const MIN_DEAL_SCORE = 50;

function getActivationThreshold(agent: BuyingAgentContext): number {
  const cfg = agent.strategyConfig as Record<string, unknown> | null;
  const val = cfg?.activationThreshold;
  if (typeof val === 'number' && val >= 0.1 && val <= 0.95) return val;
  return DEFAULT_SNIPE_THRESHOLD;
}

export const sniperStrategy: BuyingStrategy = {
  id: 'SNIPER',
  nameKey: 'strategy.buying.sniper.name',
  descriptionKey: 'strategy.buying.sniper.description',

  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null {
    if (dealScore < MIN_DEAL_SCORE) return null;

    const threshold = getActivationThreshold(agent);
    const progress = getListingProgress(listing);

    // Not yet in snipe window — wait
    if (progress < threshold) {
      return null;
    }

    // In snipe window: bid based on how close to deadline
    // At threshold → use SNIPE_MIN_RATIO, at 100% → use SNIPE_MAX_RATIO
    const snipeProgress = (progress - threshold) / (1 - threshold);
    const ratio = SNIPE_MIN_RATIO + (SNIPE_MAX_RATIO - SNIPE_MIN_RATIO) * snipeProgress;
    const bidPrice = Math.round(agent.maxBudget * ratio);
    const clampedBid = Math.min(bidPrice, listing.currentPrice);

    if (clampedBid < listing.price * 0.4) {
      return null; // Budget too low for this listing
    }

    return {
      price: clampedBid,
      reasoning: `Sniper: ${(progress * 100).toFixed(0)}% elapsed (threshold ${(threshold * 100).toFixed(0)}%). Bidding €${clampedBid} at ${(ratio * 100).toFixed(0)}% of budget.`,
    };
  },

  shouldEscalate(
    _agent: BuyingAgentContext,
    _listing: ListingContext,
    _currentOffer: OfferContext,
  ): EscalateDecision | null {
    // Sniper shoots once — no escalation
    return {
      shouldEscalate: false,
      reasoning: 'Sniper strategy: one shot only, no escalation.',
    };
  },
};

function getListingProgress(listing: ListingContext): number {
  if (!listing.expiresAt) {
    const urgencyHours = URGENCY_HOURS[listing.urgency] || 168;
    const elapsed = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60);
    return Math.min(1, elapsed / urgencyHours);
  }
  const total = listing.expiresAt.getTime() - listing.createdAt.getTime();
  const elapsed = Date.now() - listing.createdAt.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}
