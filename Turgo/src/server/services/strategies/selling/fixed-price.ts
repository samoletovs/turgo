/**
 * Fixed-Price Selling Strategy
 *
 * - Seller sets a non-negotiable price
 * - Any offer at or above the listed price is accepted automatically
 * - Offers below listed price are silently rejected
 * - No counter-offers, no haggling
 * - Simple and transparent — "buy it now"
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

export const fixedPriceStrategy: SellingStrategy = {
  id: "FIXED_PRICE",
  nameKey: "strategy.selling.fixed_price.name",
  descriptionKey: "strategy.selling.fixed_price.description",

  async processOffer(
    agent: SellingAgentContext,
    offer: OfferContext,
  ): Promise<SellingStrategyResult> {
    const { currentPrice } = agent.listing;

    // At or above listed price — auto-accept
    if (offer.price >= currentPrice) {
      return {
        action: "accept",
        acceptedOfferId: offer.id,
        reasoning: `Offer €${offer.price} meets listed price €${currentPrice}. Auto-accepted.`,
        forwardToSeller: true,
        sellerNotification: `Your listing "${agent.listing.title}" sold at €${offer.price}!`,
      };
    }

    // Below listed price — silently rejected
    return {
      action: "reject_silent",
      reasoning: `Offer €${offer.price} is below fixed price €${currentPrice}. Rejected.`,
      forwardToSeller: false,
    };
  },

  getBuyerAck(offer: OfferContext): BuyerOfferAck {
    // Same generic message — don't reveal acceptance/rejection
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
    // Fixed-price: seller sees all offers (only above-price ones reach here)
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
    // Fixed price — no automatic changes
    return [];
  },

  async onDeadlineApproaching(
    agent: SellingAgentContext,
    pendingOffers: OfferContext[],
  ): Promise<DeadlineAction | null> {
    if (pendingOffers.length === 0) return null;

    return {
      type: "NOTIFY_SELLER",
      message: `Your listing "${agent.listing.title}" is expiring soon. You have ${pendingOffers.length} accepted offer(s) awaiting finalization.`,
      offerCount: pendingOffers.length,
      bestOfferPrice: Math.max(...pendingOffers.map((o) => o.price)),
    };
  },
};
