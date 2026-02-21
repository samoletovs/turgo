/** Shared TypeScript types for the Agent-First Marketplace */

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
}

export interface AiCompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: "github" | "azure" | "ollama";
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
  autoAcceptAbove?: number;
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
  priceVsMarket: number;    // 0-30 points
  timeOnMarket: number;      // 0-15 points
  sellerUrgency: number;     // 0-15 points
  listingQuality: number;    // 0-10 points
  sellerReputation: number;  // 0-10 points
  locationConvenience: number; // 0-10 points
  conditionVsPrice: number;  // 0-10 points
  total: number;             // 0-100 total
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
