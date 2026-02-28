/**
 * Accept-Listed Buying Strategy
 *
 * The simplest buying strategy — just offers the listing price.
 * No negotiation, no games. "I'll take it at the asking price."
 *
 * Available on FREE plan since it requires no AI or complex logic.
 * Good for buyers who just want to quickly secure an item.
 */

import type {
  BuyingStrategy,
  BuyingAgentContext,
  ListingContext,
  BidDecision,
  EscalateDecision,
  OfferContext,
} from "../types";

/** Minimum deal score — lower threshold since we're paying full price */
const MIN_DEAL_SCORE = 25;

export const acceptListedStrategy: BuyingStrategy = {
  id: "ACCEPT_LISTED",
  nameKey: "strategy.buying.accept_listed.name",
  descriptionKey: "strategy.buying.accept_listed.description",

  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null {
    if (dealScore < MIN_DEAL_SCORE) return null;

    // Only bid if listing price is within budget
    if (listing.currentPrice > agent.maxBudget) {
      return null;
    }

    return {
      price: listing.currentPrice,
      reasoning: `Accept-listed: Offering listed price €${listing.currentPrice} (within budget €${agent.maxBudget}).`,
    };
  },

  shouldEscalate(
    agent: BuyingAgentContext,
    listing: ListingContext,
    currentOffer: OfferContext,
  ): EscalateDecision | null {
    // If the listing price has changed (e.g., Dutch auction dropped it),
    // we might want to match the new price
    if (listing.currentPrice < currentOffer.price) {
      // Price dropped — our existing offer is still valid (and generous)
      return {
        shouldEscalate: false,
        reasoning: "Price dropped below our offer. No action needed.",
      };
    }

    if (
      listing.currentPrice > currentOffer.price &&
      listing.currentPrice <= agent.maxBudget
    ) {
      // Price went up but still in budget — match it
      return {
        shouldEscalate: true,
        newPrice: listing.currentPrice,
        reasoning: `Listed price changed to €${listing.currentPrice}. Matching new price.`,
      };
    }

    return {
      shouldEscalate: false,
      reasoning: "Listed price unchanged or exceeds budget.",
    };
  },
};
