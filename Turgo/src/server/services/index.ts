/**
 * Barrel export for all server services
 */

// Core AI
export { aiComplete, createMessages } from "./ai";

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
export { fetchCategoryStats, runScraper } from "./scraper-sslv";
export {
  createCheckoutSession,
  createBoostPayment,
  createPortalSession,
  constructWebhookEvent,
} from "./stripe";
export { initSearchIndex, indexListing, removeListing, searchListings } from "./search";

// Storage & email
export { processAndStoreImage, validateUpload } from "./storage";
export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAgentMatchNotification,
} from "./email";
