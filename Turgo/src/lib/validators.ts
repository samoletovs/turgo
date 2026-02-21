import { z } from "zod";

// ──────────────────────────────────────────────
// AUTH VALIDATORS
// ──────────────────────────────────────────────

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    locale: z.enum(["en", "lv", "ru", "lt", "et"]).default("en"),
    marketingOptIn: z.boolean().default(false),
    gdprConsent: z.boolean().refine((v) => v, "You must accept the privacy policy"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// ──────────────────────────────────────────────
// LISTING VALIDATORS
// ──────────────────────────────────────────────

export const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("EUR"),
  negotiable: z.boolean().default(true),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]).default("USED"),
  categoryId: z.string().cuid(),
  locationId: z.string().cuid().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateListingSchema = createListingSchema.partial();

export const listingFilterSchema = z.object({
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]).optional(),
  status: z.enum(["ACTIVE", "SOLD", "EXPIRED"]).optional(),
  query: z.string().optional(),
  sortBy: z.enum(["newest", "oldest", "price_asc", "price_desc", "views"]).default("newest"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(24),
});

// ──────────────────────────────────────────────
// AGENT VALIDATORS
// ──────────────────────────────────────────────

export const createSellingAgentSchema = z.object({
  listingId: z.string().cuid().optional(), // If attaching to existing listing
  urgency: z.enum(["ONE_DAY", "THREE_DAYS", "ONE_WEEK", "TWO_WEEKS", "ONE_MONTH", "NO_RUSH"]),
  startingPrice: z.number().positive(),
  minimumPrice: z.number().positive(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  autoRespond: z.boolean().default(true),
  autoNegotiate: z.boolean().default(false),
  autoBoost: z.boolean().default(false),
  autoAcceptAbove: z.number().positive().optional(),
});

export const createBuyingAgentSchema = z.object({
  searchCriteria: z.object({
    categoryId: z.string().optional(),
    keywords: z.string().optional(),
    locationId: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    condition: z.enum(["NEW", "USED", "REFURBISHED"]).optional(),
    attributes: z.record(z.string()).optional(),
  }),
  maxBudget: z.number().positive(),
  targetPrice: z.number().positive().optional(),
  autoNegotiate: z.boolean().default(false),
  maxAutoOfferPrice: z.number().positive().optional(),
  notifyPush: z.boolean().default(true),
  notifyEmail: z.boolean().default(true),
});

export const updateAgentStatusSchema = z.object({
  agentId: z.string().cuid(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
});

// ──────────────────────────────────────────────
// MESSAGE VALIDATORS
// ──────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  receiverId: z.string().cuid(),
  listingId: z.string().cuid(),
  content: z.string().min(1, "Message cannot be empty").max(2000),
});

// ──────────────────────────────────────────────
// SEARCH VALIDATORS
// ──────────────────────────────────────────────

export const searchSchema = z.object({
  query: z.string().min(1).max(200),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(24),
});

// ──────────────────────────────────────────────
// CONCIERGE / AI VALIDATORS
// ──────────────────────────────────────────────

export const conciergeMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListingFilterInput = z.infer<typeof listingFilterSchema>;
export type CreateSellingAgentInput = z.infer<typeof createSellingAgentSchema>;
export type CreateBuyingAgentInput = z.infer<typeof createBuyingAgentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ConciergeMessageInput = z.infer<typeof conciergeMessageSchema>;
