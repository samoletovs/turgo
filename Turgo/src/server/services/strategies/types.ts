/**
 * Strategy Pattern interfaces for selling and buying agent negotiation.
 *
 * Selling strategies control how incoming offers are processed.
 * Buying strategies control how the buying agent places bids.
 */

import type {
  SellingStrategyId,
  BuyingStrategyId,
  OfferStatus,
} from "@prisma/client";

// ──────────────────────────────────────────────
// SHARED TYPES
// ──────────────────────────────────────────────

/** Minimal offer representation passed into strategies */
export interface OfferContext {
  id: string;
  price: number;
  buyerId: string;
  buyingAgentId?: string | null;
  message?: string | null;
  createdAt: Date;
}

/** Seller-facing view of an offer (what the seller sees in dashboard) */
export interface SellerOfferView {
  offerId: string;
  price: number;
  isAboveMinimum: boolean;
  createdAt: Date;
  expiresAt?: Date | null;
  status: OfferStatus;
  /** Generic label shown to seller, e.g. "Buyer #3" — no identity leak */
  buyerLabel: string;
}

/** Buyer-facing acknowledgement after submitting an offer */
export interface BuyerOfferAck {
  /** Always a generic message — no info about minimum price or acceptance */
  message: string;
  /** Status is always PENDING from buyer's perspective */
  status: "PENDING";
  offerId: string;
}

/** Result of a selling strategy processing an offer */
export interface SellingStrategyResult {
  /** What to do with this offer */
  action: "accept" | "pending" | "reject_silent";
  /** If accepted, the offer id */
  acceptedOfferId?: string;
  /** Internal reasoning (logged to AgentAction, never shown to buyer) */
  reasoning: string;
  /** Whether this offer should be forwarded to seller for manual review */
  forwardToSeller: boolean;
  /** Optional notification to send to seller */
  sellerNotification?: string;
}

/** Listing context available to strategies */
export interface ListingContext {
  id: string;
  title: string;
  price: number;
  minimumPrice: number;
  currentPrice: number;
  urgency: string;
  createdAt: Date;
  expiresAt?: Date | null;
  currency: string;
  totalViews: number;
  totalInquiries: number;
}

/** Selling agent context available to strategies */
export interface SellingAgentContext {
  id: string;
  listing: ListingContext;
  strategyConfig: Record<string, unknown> | null;
}

/** Buying agent context */
export interface BuyingAgentContext {
  id: string;
  maxBudget: number;
  targetPrice: number | null;
  strategyConfig: Record<string, unknown> | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

// ──────────────────────────────────────────────
// SELLING STRATEGY INTERFACE
// ──────────────────────────────────────────────

export interface SellingStrategy {
  /** Unique identifier matching the Prisma enum */
  id: SellingStrategyId;

  /** Human-readable name (i18n key) */
  nameKey: string;

  /** Short description (i18n key) */
  descriptionKey: string;

  /**
   * Process an incoming offer.
   * MUST NOT leak any price information to the buyer.
   */
  processOffer(
    agent: SellingAgentContext,
    offer: OfferContext,
  ): Promise<SellingStrategyResult>;

  /**
   * Generate the buyer-facing acknowledgement.
   * Default should always be a generic "offer submitted" message.
   */
  getBuyerAck(offer: OfferContext): BuyerOfferAck;

  /**
   * Get offers visible to the seller (filtered per strategy rules).
   * E.g. sealed-bid hides below-minimum offers.
   */
  getSellerView(
    agent: SellingAgentContext,
    offers: OfferContext[],
  ): SellerOfferView[];

  /**
   * Called periodically (e.g. daily cron) for time-based actions.
   * Dutch auction uses this to lower price.
   */
  onTick?(agent: SellingAgentContext): Promise<TickAction[]>;

  /**
   * Called when listing is approaching expiry.
   * Can prompt seller about pending offers.
   */
  onDeadlineApproaching?(
    agent: SellingAgentContext,
    pendingOffers: OfferContext[],
  ): Promise<DeadlineAction | null>;
}

// ──────────────────────────────────────────────
// BUYING STRATEGY INTERFACE
// ──────────────────────────────────────────────

export interface BuyingStrategy {
  /** Unique identifier matching the Prisma enum */
  id: BuyingStrategyId;

  /** Human-readable name (i18n key) */
  nameKey: string;

  /** Short description (i18n key) */
  descriptionKey: string;

  /**
   * Calculate the bid price for a matched listing.
   * Returns null if the strategy decides not to bid yet.
   */
  calculateBid(
    agent: BuyingAgentContext,
    listing: ListingContext,
    dealScore: number,
  ): BidDecision | null;

  /**
   * Should the agent escalate its bid?
   * Called periodically on listings where an offer is already pending.
   */
  shouldEscalate?(
    agent: BuyingAgentContext,
    listing: ListingContext,
    currentOffer: OfferContext,
  ): EscalateDecision | null;
}

// ──────────────────────────────────────────────
// ACTION TYPES
// ──────────────────────────────────────────────

export interface TickAction {
  type: "PRICE_ADJUST" | "NOTIFICATION";
  newPrice?: number;
  message?: string;
  reason: string;
}

export interface DeadlineAction {
  type: "NOTIFY_SELLER";
  message: string;
  offerCount: number;
  bestOfferPrice: number;
}

export interface BidDecision {
  price: number;
  reasoning: string;
  /** Optional message to attach to the offer */
  message?: string;
}

export interface EscalateDecision {
  shouldEscalate: boolean;
  newPrice?: number;
  reasoning: string;
}

// ──────────────────────────────────────────────
// STRATEGY METADATA (for UI display)
// ──────────────────────────────────────────────

export interface StrategyMeta {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Which plans can use this strategy */
  requiredPlan: "FREE" | "PRO" | "BUSINESS";
  /** Whether it requires autoNegotiate capability */
  requiresAutoNegotiate: boolean;
}

export interface SellingStrategyMeta extends StrategyMeta {
  id: SellingStrategyId;
}

export interface BuyingStrategyMeta extends StrategyMeta {
  id: BuyingStrategyId;
}
