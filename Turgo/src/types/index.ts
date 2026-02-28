/** Shared TypeScript types for Turgo — Agent-First Classifieds */

// Re-export Prisma-generated types for convenience
export type {
  User,
  Category,
  CategoryAttribute,
  Listing,
  ListingImage,
  ListingAttribute,
  Location,
  Conversation,
  Message,
  Favorite,
  SavedSearch,
  Review,
  PriceHistory,
  Plan,
  Subscription,
  ListingBoost,
  SellingAgent,
  BuyingAgent,
  AgentAction,
  AgentMatch,
  MarketSnapshot,
  PushSubscription,
  Notification,
} from "@prisma/client";

// ──────────────────────────────────────────────
// AI TYPES
// ──────────────────────────────────────────────

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionOptions {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: { type: "json_object" | "text" };
}

export interface AiCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: "github" | "azure";
}

export interface AiEmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: "github" | "azure";
  tokensUsed?: number;
}

export interface AiImageAnalysis {
  description: string;
  tags: string[];
  suggestedCategory?: string;
  suggestedTitle?: string;
  confidence: number;
}

export interface AiPriceSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  reasoning: string;
  comparableListings: number;
}

// ──────────────────────────────────────────────
// AGENT TYPES
// ──────────────────────────────────────────────

export type AgentIntent = "sell" | "buy" | "support" | "browse" | "other";

export interface ConciergeResponse {
  intent: AgentIntent;
  message: string;
  suggestedActions?: SuggestedAction[];
  data?: Record<string, unknown>;
}

export interface SuggestedAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

export interface SellingAgentConfig {
  urgency: string;
  startingPrice: number;
  minimumPrice: number;
  autoRespond: boolean;
  autoNegotiate: boolean;
  autoBoost: boolean;
  sellingStrategyId?: "SEALED_BID" | "FIXED_PRICE" | "DUTCH_AUCTION";
  strategyConfig?: Record<string, unknown>;
}

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellingAgentId: string;
  buyingAgentId?: string | null;
  amount: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED" | "EXPIRED";
  buyerAckMessage?: string | null;
  sellerNote?: string | null;
  strategyResult?: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PricingFactors {
  urgency: number;
  marketSupply: number;
  marketDemand: number;
  seasonality: number;
  condition: number;
  locationDemand: number;
  postingTiming: number;
  competitionAge: number;
  priceElasticity: number;
  sellerReputation: number;
}

export interface PricingCurvePoint {
  day: number;
  price: number;
  reason: string;
}

export interface DealScoreBreakdown {
  priceVsMarket: number; // 0-30 points
  timeOnMarket: number; // 0-15 points
  sellerUrgency: number; // 0-15 points
  listingQuality: number; // 0-10 points
  sellerReputation: number; // 0-10 points
  locationConvenience: number; // 0-10 points
  conditionVsPrice: number; // 0-10 points
  total: number; // 0-100 total
}

// ──────────────────────────────────────────────
// SCRAPER TYPES
// ──────────────────────────────────────────────

export interface ScraperCategoryStats {
  categorySlug: string;
  locationSlug?: string;
  medianPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  listingCount: number;
  avgDaysToSell?: number;
}

// ──────────────────────────────────────────────
// UI TYPES
// ──────────────────────────────────────────────

export interface ListingCardData {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  location?: string;
  imageUrl?: string;
  imageCount?: number;
  isFeatured?: boolean;
  hasAgent?: boolean;
  createdAt: Date;
}

export interface CategoryWithCount {
  id: string;
  name: Record<string, string>;
  slug: string;
  icon: string | null;
  _count: { listings: number };
  children?: CategoryWithCount[];
}

export interface ConversationPreview {
  id: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  listing: {
    id: string;
    title: string;
    imageUrl?: string;
    price: number;
  };
}

// ──────────────────────────────────────────────
// MESSAGING TYPES
// ──────────────────────────────────────────────

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  isRead: boolean;
  isAgentMessage: boolean;
  translatedContent: Record<string, string> | null;
  originalLanguage: string | null;
  metadata: Record<string, unknown> | null;
  requiresApproval: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface NegotiationStep {
  id: string;
  messageType: string;
  isOwn: boolean;
  isAgentMessage: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

export interface TranslationResult {
  translation: string;
  locale: string;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}
