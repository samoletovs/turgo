/**
 * Barrel export for all server services
 */

// Core AI — unified router + provider-specific modules
export { aiComplete, aiEmbed, aiAnalyzeImage, createMessages, getAiProviderInfo } from "./ai";
export type { AiProvider, UserTier } from "./ai";

// AI Providers (for direct access if needed)
export { githubModelsComplete, githubModelsEmbed, githubModelsAnalyzeImage } from "./ai-dev";
export { azureOpenAiComplete, azureOpenAiEmbed, azureAnalyzeImage, azureVisionAnalyze } from "./ai-premium";
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

// Orchestration
export {
  scheduleJob,
  scheduleRecurring,
  registerWorker,
  transitionAgent,
  initializeOrchestrator,
} from "./agent-orchestrator";

// External integrations
export { fetchCategoryStats, runScraper, isScrapingEnabled, createScraperWorker } from "./scraper-sslv";
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
