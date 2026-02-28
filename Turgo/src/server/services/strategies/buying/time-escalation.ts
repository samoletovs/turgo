/**
 * Time-Escalation Buying Strategy
 *
 * Starts bidding conservatively (around idealPrice or 70% of maxBudget)
 * and escalates towards maxBudget as the listing approaches expiry.
 *
 * Bid formula:  idealPrice + (maxBudget - idealPrice) × progress^curve
 * where progress = elapsed / totalDuration
 *
 * Designed to get good deals early, but not miss out as deadline nears.
 */

import type {
  BuyingStrategy,
  BuyingAgentContext,
  ListingContext,
  BidDecision,
  EscalateDecision,
  OfferContext,
} from "../types";
import { URGENCY_HOURS } from "@/lib/constants";

/** Default curve exponent — higher = more patient (stays low longer) */
const DEFAULT_CURVE_EXPONENT = 1.8;

/** Don't bid if deal score is below this */
const MIN_DEAL_SCORE = 40;

export const timeEscalationStrategy: BuyingStrategy = {
  id: "TIME_ESCALATION",
  nameKey: "strategy.buying.time_escalation.name",
  descriptionKey: "strategy.buying.time_escalation.description",

  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null {
    if (dealScore < MIN_DEAL_SCORE) return null;

    const progress = getListingProgress(listing);
    const curveExponent = getCurveExponent(agent);
    const floor = agent.targetPrice ?? agent.maxBudget * 0.7;
    const ceiling = agent.maxBudget;

    // Escalation: floor + (ceiling - floor) × progress^curve
    const escalationFactor = Math.pow(progress, curveExponent);
    const bidPrice = Math.round(floor + (ceiling - floor) * escalationFactor);
    const clampedBid = Math.min(bidPrice, ceiling);

    // Don't bid above listing price — would be overpaying
    const finalBid = Math.min(clampedBid, listing.currentPrice);

    if (finalBid < listing.price * 0.5) {
      // Don't insult with absurdly low offers
      return null;
    }

    return {
      price: finalBid,
      reasoning: `Time-escalation: ${(progress * 100).toFixed(0)}% elapsed → bid €${finalBid} (floor: €${floor}, ceiling: €${ceiling}, factor: ${escalationFactor.toFixed(2)})`,
    };
  },

  shouldEscalate(
    agent: BuyingAgentContext,
    listing: ListingContext,
    currentOffer: OfferContext,
  ): EscalateDecision | null {
    const progress = getListingProgress(listing);
    const curveExponent = getCurveExponent(agent);
    const floor = agent.targetPrice ?? agent.maxBudget * 0.7;
    const ceiling = agent.maxBudget;

    const escalationFactor = Math.pow(progress, curveExponent);
    const newBid = Math.round(floor + (ceiling - floor) * escalationFactor);
    const clampedBid = Math.min(newBid, ceiling, listing.currentPrice);

    // Only escalate if the new bid is at least 3% higher
    const minIncrement = currentOffer.price * 0.03;

    if (clampedBid - currentOffer.price >= minIncrement) {
      return {
        shouldEscalate: true,
        newPrice: clampedBid,
        reasoning: `Time to escalate: ${(progress * 100).toFixed(0)}% elapsed. Raising from €${currentOffer.price} to €${clampedBid}.`,
      };
    }

    return {
      shouldEscalate: false,
      reasoning: `Not yet time to escalate. Current: €${currentOffer.price}, would-be: €${clampedBid}. Difference too small.`,
    };
  },
};

function getListingProgress(listing: ListingContext): number {
  if (!listing.expiresAt) {
    // Fallback: use urgency
    const urgencyHours = URGENCY_HOURS[listing.urgency] || 168;
    const elapsed =
      (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60);
    return Math.min(1, elapsed / urgencyHours);
  }
  const total = listing.expiresAt.getTime() - listing.createdAt.getTime();
  const elapsed = Date.now() - listing.createdAt.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}

function getCurveExponent(agent: BuyingAgentContext): number {
  return (
    ((agent.strategyConfig as Record<string, unknown>)
      ?.curveExponent as number) ?? DEFAULT_CURVE_EXPONENT
  );
}
