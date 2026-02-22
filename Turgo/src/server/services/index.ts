/**
 * Barrel export for all server services
 */

// Core AI — unified router + provider-specific modules
export {
  aiComplete,
  aiEmbed,
  aiAnalyzeImage,
  createMessages,
  getAiProviderInfo,
} from "./ai";
export type { AiProvider, UserTier } from "./ai";

// AI Providers (for direct access if needed)
export {
  githubModelsComplete,
  githubModelsEmbed,
  githubModelsAnalyzeImage,
} from "./ai-dev";
export {
  azureOpenAiComplete,
  azureOpenAiEmbed,
  azureAnalyzeImage,
  azureVisionAnalyze,
} from "./ai-premium";
export { ollamaComplete, ollamaEmbed, freeAnalyzeImage } from "./ai-free";

// Agent services
export { processConciergeMessage, detectLanguage } from "./agent-concierge";
export {
  calculateOptimalPrice,
  generateAutoResponse,
  shouldAdjustPrice,
} from "./agent-selling";
export { calculateDealScore, monitorForMatches } from "./agent-buying";
export {
  getMarketStats,
  generatePriceCurve,
  getOptimalPostingTime,
  generatePriceAdjustSchedule,
} from "./agent-pricing";

// New operational agents
export { moderateListing } from "./agent-moderation";
export type { ModerationResult, ModerationOutcome } from "./agent-moderation";
export { handleSupportMessage, getQuickAnswer } from "./agent-support";
export type { SupportResponse, SupportCategory } from "./agent-support";
export { checkListingFraud, checkMessageFraud } from "./agent-antifraud";
export type { FraudCheckResult, FraudRisk } from "./agent-antifraud";
export { runDailyQualityCheck, calculateListingQuality } from "./agent-quality";
export type { QualityReport, ListingQualityScore } from "./agent-quality";
export {
  generateListingSeo,
  generateCategorySeo,
  generateSitemap,
  auditHreflang,
  runSeoOptimization,
} from "./agent-seo";
export type { SeoMetadata, SeoReport } from "./agent-seo";
export { runDailyEngagement } from "./agent-engagement";
export type { EngagementReport } from "./agent-engagement";
export { generateDailyReport, generateWeeklySummary } from "./agent-analytics";
export type {
  PlatformHealthReport,
  Anomaly,
  WeeklySummary,
} from "./agent-analytics";

// Liquidation Agent
export {
  createLiquidationBatch,
  getLiquidationBatchStats,
  getUserLiquidationBatches,
  adjustLiquidationBatchPricing,
} from "./agent-liquidation";
export type {
  LiquidationBatchConfig,
  LiquidationBatchStats,
  LiquidationItem,
} from "./agent-liquidation";

// Timing Agent
export { getOptimalTiming, getTimingRecommendation } from "./agent-timing";
export type {
  OptimalTimingResult,
  SeasonalPattern,
  WeekdayPattern,
  TimingRecommendation,
} from "./agent-timing";

// Watchdog Agent
export {
  checkForDuplicates,
  scanMessage,
  scanRecentMessages,
} from "./agent-watchdog";
export type {
  DuplicateCheckResult,
  MessageScanResult,
  WatchdogAlert,
  WatchdogAlertType,
  WatchdogSeverity,
} from "./agent-watchdog";

// Swap/Barter Agent
export {
  findSwapCandidates,
  generateSwapProposal,
  runSwapMatching,
} from "./agent-swap";
export type {
  SwapCandidate,
  SwapProposal,
  SwapSearchResult,
} from "./agent-swap";

// Orchestration
export {
  scheduleJob,
  scheduleRecurring,
  registerWorker,
  transitionAgent,
  initializeOrchestrator,
} from "./agent-orchestrator";
export { registerAllWorkers } from "./agent-workers";

// External integrations
export {
  fetchCategoryStats,
  runScraper,
  isScrapingEnabled,
  createScraperWorker,
} from "./scraper-sslv";
export {
  createCheckoutSession,
  createBoostPayment,
  createPortalSession,
  constructWebhookEvent,
  getOrCreateCustomer,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  isStripeConfigured,
} from "./stripe";
export {
  initSearchIndex,
  indexListing,
  removeListing,
  searchListings,
  bulkIndexListings,
  searchSuggestions,
  savedSearchMatchesListing,
  isSearchHealthy,
  toSearchDocument,
} from "./search";

// Storage & email
export { processAndStoreImage, validateUpload } from "./storage";
export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAgentMatchNotification,
  sendSavedSearchNotification,
} from "./email";

// Messaging
export {
  processAutoRespond,
  processAutoNegotiate,
  approveAgentMessage,
  rejectAgentMessage,
  sendBuyingAgentMessage,
  isAvailabilityQuestion,
  extractOfferAmount,
} from "./messaging";

// Translation
export {
  translateMessage,
  translateToAll,
  translateAndStoreMessage,
  translateMessageOnDemand,
  detectLanguage as detectMessageLanguage,
  userHasTranslation,
} from "./translation";

// Notifications
export {
  sendPushNotification,
  createNotification,
  notifyNewMessage,
  notifyNegotiationEvent,
  notifyPriceDrop,
  checkAndNotifySavedSearchMatches,
  registerPushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  sendAgentSummaryEmail,
} from "./notification";

// View counter
export {
  incrementViewCount,
  getViewCount,
  flushViewCounts,
} from "./view-counter";
