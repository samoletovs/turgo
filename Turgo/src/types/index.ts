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
  provider: "github" | "azure" | "ollama";
}

export interface AiEmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: "github" | "azure" | "ollama";
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

// ──────────────────────────────────────────────
// LIQUIDATION TYPES
// ──────────────────────────────────────────────

export interface LiquidationBatchConfig {
  userId: string;
  listingIds: string[];
  deadline: Date;
  urgency: string;
  strategy: "aggressive" | "balanced" | "patient";
  autoAcceptAbove?: number;
}

export interface LiquidationBatchStats {
  batchId: string;
  totalItems: number;
  itemsSold: number;
  itemsRemaining: number;
  itemsCancelled: number;
  totalRevenue: number;
  projectedRemainingValue: number;
  totalStartingValue: number;
  avgDiscountPercent: number;
  deadline: Date;
  deadlineProgress: number;
  items: LiquidationItemData[];
}

export interface LiquidationItemData {
  listingId: string;
  sellingAgentId: string;
  title: string;
  startingPrice: number;
  currentPrice: number;
  minimumPrice: number;
  status: string;
  soldPrice?: number;
}

// ──────────────────────────────────────────────
// TIMING TYPES
// ──────────────────────────────────────────────

export interface SeasonalPattern {
  month: number;
  monthName: string;
  avgPrice: number;
  avgDaysToSell: number;
  listingCount: number;
  demandScore: number;
  sellRating: number;
}

export interface WeekdayPattern {
  dayOfWeek: number;
  dayName: string;
  avgListings: number;
  avgDemandScore: number;
  sellRating: number;
}

export interface OptimalTimingResult {
  categoryId: string;
  categoryName: string;
  locationId?: string;
  locationName?: string;
  bestMonth: number;
  bestMonthName: string;
  bestDayOfWeek: number;
  bestDayName: string;
  bestHour: number;
  currentTimingScore: number;
  recommendation: string;
  seasonalCalendar: SeasonalPattern[];
  weekdayCalendar: WeekdayPattern[];
}

export interface TimingRecommendation {
  score: number;
  action: "post_now" | "wait" | "good_enough";
  message: string;
  bestUpcoming: {
    date: string;
    reason: string;
  };
}

// ──────────────────────────────────────────────
// WATCHDOG TYPES
// ──────────────────────────────────────────────

export type WatchdogAlertType =
  | "DUPLICATE_LISTING"
  | "SIMILAR_LISTING"
  | "SCAM_MESSAGE"
  | "SUSPICIOUS_LINK"
  | "LOWBALL_PATTERN"
  | "DEPOSIT_REQUEST";

export type WatchdogSeverity = "INFO" | "WARNING" | "DANGER";

export interface WatchdogAlert {
  type: WatchdogAlertType;
  severity: WatchdogSeverity;
  score: number;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarListings: Array<{
    listingId: string;
    title: string;
    titleSimilarity: number;
    descriptionSimilarity: number;
    priceDifference: number;
    imageSimilarity: number;
    overallScore: number;
  }>;
  alerts: WatchdogAlert[];
}

export interface MessageScanResult {
  isClean: boolean;
  alerts: WatchdogAlert[];
  shouldBlock: boolean;
  shouldFlag: boolean;
}

// ──────────────────────────────────────────────
// SWAP/BARTER TYPES
// ──────────────────────────────────────────────

export interface SwapCandidate {
  listing: {
    id: string;
    title: string;
    price: number;
    currency: string;
    condition: string;
    categoryId: string;
    categoryName: string;
    locationId: string | null;
    imageUrl: string | null;
    userId: string;
    userName: string | null;
  };
  matchScore: number;
  marketValuation: number;
  cashDifference: number;
  reasons: string[];
  demandSignals: Array<{
    type: string;
    description: string;
    strength: number;
  }>;
}

export interface SwapProposal {
  myListingId: string;
  theirListingId: string;
  myMarketValue: number;
  theirMarketValue: number;
  cashDifference: number;
  message: string;
}

export interface SwapSearchResult {
  myListing: {
    id: string;
    title: string;
    price: number;
    marketValuation: number;
  };
  candidates: SwapCandidate[];
  totalFound: number;
}
