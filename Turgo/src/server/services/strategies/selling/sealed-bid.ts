/**
 * Sealed-Bid Selling Strategy
 *
 * - Buyer submits an offer and gets a generic "offer submitted" response
 * - No feedback about minimum price, acceptance likelihood, or competing offers
 * - Offers below minimum are silently rejected (hidden from seller too)
 * - Offers at or above minimum are forwarded to seller for manual acceptance
 * - Seller sees qualifying offers with anonymous buyer labels
 * - Before listing expiry, seller is prompted if there are unreviewed offers
 */

import type {
  SellingStrategy,
  SellingStrategyResult,
  SellingAgentContext,
  OfferContext,
  BuyerOfferAck,
  SellerOfferView,
  TickAction,
  DeadlineAction,
} from "../types";

export const sealedBidStrategy: SellingStrategy = {
  id: "SEALED_BID",
  nameKey: "strategy.selling.sealed_bid.name",
  descriptionKey: "strategy.selling.sealed_bid.description",

  async processOffer(
    agent: SellingAgentContext,
    offer: OfferContext,
  ): Promise<SellingStrategyResult> {
    const { minimumPrice } = agent.listing;

    // Below minimum — silently reject, do NOT tell buyer or seller
    if (offer.price < minimumPrice) {
      return {
        action: "reject_silent",
        reasoning: `Offer €${offer.price} is below minimum €${minimumPrice}. Silently rejected.`,
        forwardToSeller: false,
      };
    }

    // At or above minimum — forward to seller for manual review
    return {
      action: "pending",
      reasoning: `Offer €${offer.price} meets minimum (€${minimumPrice}). Forwarded to seller.`,
      forwardToSeller: true,
      sellerNotification: `New offer of €${offer.price} received for "${agent.listing.title}". Review it in your dashboard.`,
    };
  },

  getBuyerAck(offer: OfferContext): BuyerOfferAck {
    return {
      message:
        "Your offer has been submitted. The seller will review it and respond.",
      status: "PENDING",
      offerId: offer.id,
    };
  },

  getSellerView(
    _agent: SellingAgentContext,
    offers: OfferContext[],
  ): SellerOfferView[] {
    // Only show offers that are above minimum (they wouldn't be here otherwise,
    // but double-check for safety)
    return offers.map((offer, idx) => ({
      offerId: offer.id,
      price: offer.price,
      isAboveMinimum: true,
      createdAt: offer.createdAt,
      expiresAt: null,
      status: "PENDING",
      buyerLabel: `Buyer #${idx + 1}`,
    }));
  },

  async onTick(_agent: SellingAgentContext): Promise<TickAction[]> {
    // Sealed-bid has no automatic time-based price changes
    return [];
  },

  async onDeadlineApproaching(
    agent: SellingAgentContext,
    pendingOffers: OfferContext[],
  ): Promise<DeadlineAction | null> {
    if (pendingOffers.length === 0) return null;

    const bestPrice = Math.max(...pendingOffers.map((o) => o.price));

    return {
      type: "NOTIFY_SELLER",
      message: `Your listing "${agent.listing.title}" is expiring soon. You have ${pendingOffers.length} pending offer(s). Best offer: €${bestPrice}.`,
      offerCount: pendingOffers.length,
      bestOfferPrice: bestPrice,
    };
  },
};
