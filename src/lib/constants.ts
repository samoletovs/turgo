/** Application-wide constants */

export const APP_NAME = 'Turgo';
export const APP_DESCRIPTION = 'Agent-first classifieds platform for the Baltics';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** Supported locales */
export const LOCALES = ['en', 'lv', 'ru', 'lt', 'et'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Locale labels for UI */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  lv: 'Latviešu',
  ru: 'Русский',
  lt: 'Lietuvių',
  et: 'Eesti',
};

/** Locale flags */
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  lv: '🇱🇻',
  ru: '🇷🇺',
  lt: '🇱🇹',
  et: '🇪🇪',
};

/** Baltic country codes */
export const COUNTRIES = ['LV', 'LT', 'EE'] as const;
export type CountryCode = (typeof COUNTRIES)[number];

/** Plan limits */
export const PLAN_LIMITS = {
  FREE: {
    maxListings: 5,
    maxSellingAgents: 1,
    maxBuyingAgents: 1,
    maxPhotosPerListing: 5,
    maxSavedSearches: 3,
    listingDurationDays: 30,
    hasAiPremium: false,
    hasAnalytics: false,
    hasAutoNegotiate: false,
    hasAutoTranslate: false,
  },
  PRO: {
    maxListings: 50,
    maxSellingAgents: 5,
    maxBuyingAgents: 5,
    maxPhotosPerListing: 15,
    maxSavedSearches: 20,
    listingDurationDays: 60,
    hasAiPremium: true,
    hasAnalytics: true,
    hasAutoNegotiate: true,
    hasAutoTranslate: true,
  },
  BUSINESS: {
    maxListings: 999999,
    maxSellingAgents: 999999,
    maxBuyingAgents: 999999,
    maxPhotosPerListing: 30,
    maxSavedSearches: 999999,
    listingDurationDays: 90,
    hasAiPremium: true,
    hasAnalytics: true,
    hasAutoNegotiate: true,
    hasAutoTranslate: true,
  },
} as const;

/** Plan pricing */
export const PLAN_PRICES = {
  FREE: { monthly: 0, yearly: 0 },
  PRO: { monthly: 4.99, yearly: 47.88 },
  BUSINESS: { monthly: 19.99, yearly: 191.88 },
} as const;

/** Boost pricing (in EUR cents) */
export const BOOST_PRICES = {
  FEATURED: { amount: 499, durationDays: 7, label: 'Featured' },
  HIGHLIGHTED: { amount: 299, durationDays: 3, label: 'Highlighted' },
  TOP: { amount: 999, durationDays: 7, label: 'Top Placement' },
} as const;

/** Rate limiting */
export const RATE_LIMITS = {
  AUTH: { max: 5, windowMs: 60_000 },
  API: { max: 100, windowMs: 60_000 },
  UPLOAD: { max: 30, windowMs: 3_600_000 },
  AGENT: { max: 50, windowMs: 60_000 },
  CONCIERGE: { max: 20, windowMs: 60_000 },
  REGISTER: { max: 5, windowMs: 3_600_000 },
  PASSWORD_RESET: { max: 3, windowMs: 3_600_000 },
  LISTING_CREATE: { max: 30, windowMs: 3_600_000 },
  MESSAGE_SEND: { max: 60, windowMs: 60_000 },
  AGENT_CREATE: { max: 10, windowMs: 3_600_000 },
} as const;

/** File upload constraints */
export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  THUMBNAIL_SIZE: { width: 150, height: 150 },
  CARD_SIZE: { width: 400, height: 300 },
  DETAIL_SIZE: { width: 800, height: 600 },
} as const;

/** Agent urgency to hours mapping */
export const URGENCY_HOURS: Record<string, number> = {
  ONE_DAY: 24,
  THREE_DAYS: 72,
  ONE_WEEK: 168,
  TWO_WEEKS: 336,
  ONE_MONTH: 720,
  NO_RUSH: 2160, // 90 days
};

/** Primary color palette */
export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
} as const;
