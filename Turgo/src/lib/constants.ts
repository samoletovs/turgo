/** Application-wide constants */

export const APP_NAME = "Turgo";
export const APP_DESCRIPTION = "Agent-first classifieds platform for the Baltics";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Supported locales */
export const LOCALES = ["en", "lv", "ru", "lt", "et"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Locale labels for UI */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  lv: "Latviešu",
  ru: "Русский",
  lt: "Lietuvių",
  et: "Eesti",
};

/** Locale flags */
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  lv: "🇱🇻",
  ru: "🇷🇺",
  lt: "🇱🇹",
  et: "🇪🇪",
};

/** Baltic country codes */
export const COUNTRIES = ["LV", "LT", "EE"] as const;
export type CountryCode = (typeof COUNTRIES)[number];

/** Plan limits */
export const PLAN_LIMITS = {
  FREE: {
    maxListings: 10,
    maxSellingAgents: 1,
    maxBuyingAgents: 1,
    maxPhotosPerListing: 5,
    maxSavedSearches: 3,
    listingDurationDays: 30,
  },
  PRO: {
    maxListings: 50,
    maxSellingAgents: 5,
    maxBuyingAgents: 5,
    maxPhotosPerListing: 15,
    maxSavedSearches: 20,
    listingDurationDays: 60,
  },
  BUSINESS: {
    maxListings: 999999,
    maxSellingAgents: 999999,
    maxBuyingAgents: 999999,
    maxPhotosPerListing: 30,
    maxSavedSearches: 999999,
    listingDurationDays: 90,
  },
} as const;

/** Rate limiting */
export const RATE_LIMITS = {
  AUTH: { max: 5, windowMs: 60_000 },
  API: { max: 100, windowMs: 60_000 },
  UPLOAD: { max: 20, windowMs: 60_000 },
  AGENT: { max: 50, windowMs: 60_000 },
} as const;

/** File upload constraints */
export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
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
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#3B82F6",
} as const;
