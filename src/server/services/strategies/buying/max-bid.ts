/**
 * Max-Bid Buying Strategy
 *
 * Immediately bids the buyer's maximum budget.
 * Simple strategy — "offer the most I'm willing to pay, right away."
 *
 * Good for high-demand items where the buyer doesn't want to miss out.
 * No escalation needed since we bid max from the start.
 */

import type {
  BuyingStrategy,
  BuyingAgentContext,
  ListingContext,
  BidDecision,
  EscalateDecision,
  OfferContext,
} from '../types';

/** Minimum deal score to trigger a bid */
const MIN_DEAL_SCORE = 30;

export const maxBidStrategy: BuyingStrategy = {
  id: 'MAX_BID',
  nameKey: 'strategy.buying.max_bid.name',
  descriptionKey: 'strategy.buying.max_bid.description',

  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null {
    if (dealScore < MIN_DEAL_SCORE) return null;

    // Bid the lesser of maxBudget or listing price (no overpaying)
    const bidPrice = Math.min(agent.maxBudget, listing.currentPrice);

    if (bidPrice < listing.price * 0.5) {
      // Budget is too low relative to listing — skip
      return null;
    }

    return {
      price: bidPrice,
      reasoning: `Max-bid: Offering maximum budget €${bidPrice} immediately (maxBudget: €${agent.maxBudget}, listing: €${listing.currentPrice}).`,
    };
  },

  shouldEscalate(
    _agent: BuyingAgentContext,
    _listing: ListingContext,
    _currentOffer: OfferContext,
  ): EscalateDecision | null {
    // Already at max — nothing to escalate to
    return {
      shouldEscalate: false,
      reasoning: 'Max-bid strategy already bid the maximum. No escalation possible.',
    };
  },
};
