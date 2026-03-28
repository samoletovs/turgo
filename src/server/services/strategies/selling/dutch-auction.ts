/**
 * Dutch Auction Selling Strategy
 *
 * - Price starts high and drops automatically over time
 * - Uses the urgency-based pricing curve from agent-pricing.ts
 * - Any offer at or above the CURRENT (declining) price is auto-accepted
 * - Offers below current price are silently rejected
 * - Seller cannot manually accept below-current-price offers
 * - onTick() drives the automatic price reductions
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
} from '../types';
import { URGENCY_HOURS } from '@/lib/constants';

export const dutchAuctionStrategy: SellingStrategy = {
  id: 'DUTCH_AUCTION',
  nameKey: 'strategy.selling.dutch_auction.name',
  descriptionKey: 'strategy.selling.dutch_auction.description',

  async processOffer(
    agent: SellingAgentContext,
    offer: OfferContext,
  ): Promise<SellingStrategyResult> {
    const { currentPrice, title } = agent.listing;

    // At or above current (declining) price — auto-accept
    if (offer.price >= currentPrice) {
      return {
        action: 'accept',
        acceptedOfferId: offer.id,
        reasoning: `Offer €${offer.price} meets current Dutch price €${currentPrice}. Auto-accepted.`,
        forwardToSeller: true,
        sellerNotification: `Your listing "${title}" sold at €${offer.price} (Dutch auction)!`,
      };
    }

    // Below current price — silently rejected
    return {
      action: 'reject_silent',
      reasoning: `Offer €${offer.price} is below current Dutch price €${currentPrice}. Rejected.`,
      forwardToSeller: false,
    };
  },

  getBuyerAck(offer: OfferContext): BuyerOfferAck {
    return {
      message: 'Your offer has been submitted. The seller will review it and respond.',
      status: 'PENDING',
      offerId: offer.id,
    };
  },

  getSellerView(_agent: SellingAgentContext, offers: OfferContext[]): SellerOfferView[] {
    return offers.map((offer, idx) => ({
      offerId: offer.id,
      price: offer.price,
      isAboveMinimum: true,
      createdAt: offer.createdAt,
      expiresAt: null,
      status: 'PENDING',
      buyerLabel: `Buyer #${idx + 1}`,
    }));
  },

  async onTick(agent: SellingAgentContext): Promise<TickAction[]> {
    const { listing, strategyConfig } = agent;
    const urgencyHours = URGENCY_HOURS[listing.urgency] || 168;
    const totalDays = urgencyHours / 24;
    const daysActive = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const progress = Math.min(1, daysActive / totalDays);

    // Calculate where price should be on the decay curve
    const startPrice = (strategyConfig as Record<string, unknown>)?.startPrice
      ? Number((strategyConfig as Record<string, unknown>).startPrice)
      : listing.price;
    const minPrice = listing.minimumPrice;

    // Exponential decay: steeper towards end
    const exponent = 1.5;
    const decay = Math.pow(1 - progress, exponent);
    const targetPrice = Math.round(minPrice + (startPrice - minPrice) * decay);
    const clampedTarget = Math.max(targetPrice, minPrice);

    // Only adjust if difference is meaningful (> 1%)
    if (
      listing.currentPrice > clampedTarget &&
      listing.currentPrice - clampedTarget > listing.currentPrice * 0.01
    ) {
      return [
        {
          type: 'PRICE_ADJUST',
          newPrice: clampedTarget,
          reason: `Dutch auction: ${(progress * 100).toFixed(0)}% elapsed. Reducing from €${listing.currentPrice} to €${clampedTarget}.`,
        },
      ];
    }

    return [];
  },

  async onDeadlineApproaching(
    agent: SellingAgentContext,
    pendingOffers: OfferContext[],
  ): Promise<DeadlineAction | null> {
    // Dutch auction mostly auto-handles via price drops,
    // but notify if there are any pending
    if (pendingOffers.length === 0) return null;

    const bestPrice = Math.max(...pendingOffers.map((o) => o.price));

    return {
      type: 'NOTIFY_SELLER',
      message: `Your Dutch auction for "${agent.listing.title}" is ending soon. Current price: €${agent.listing.currentPrice}. ${pendingOffers.length} offer(s) pending, best at €${bestPrice}.`,
      offerCount: pendingOffers.length,
      bestOfferPrice: bestPrice,
    };
  },
};
