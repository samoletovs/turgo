import type { ReactNode, Dispatch, SetStateAction, RefObject } from "react";

// ──────────────────────────────────────────────
// STEP & DATA TYPES
// ──────────────────────────────────────────────

export type SellingWizardStep =
  | "greeting"
  | "photos"
  | "analyzing"
  | "confirm_details"
  | "category"
  | "pricing"
  | "urgency"
  | "agent_config"
  | "strategy"
  | "agent_proposal"
  | "summary"
  | "publishing"
  | "done";

export interface ChatAction {
  label: string;
  value: string;
  desc?: string;
}

export interface ChatMsg {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: Date;
  component?: ReactNode;
  actions?: ChatAction[];
}

export interface SellingWizardData {
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  condition: string;
  locationId: string;
  price: number;
  aiSuggestedPrice: number | null;
  photos: File[];
  photoPreviews: string[];
  urgency: string;
  minimumPrice: number;
  autoRespond: boolean;
  autoNegotiate: boolean;
  autoBoost: boolean;
  sellingStrategyId: "SEALED_BID" | "FIXED_PRICE" | "DUTCH_AUCTION";
}

export type JsonName = string | Record<string, string>;

export interface CategoryItem {
  id: string;
  name: JsonName;
  slug: string;
  children?: { id: string; name: JsonName; slug: string }[];
}

export interface LocationItem {
  id: string;
  name: JsonName;
  slug: string;
  children?: { id: string; name: JsonName; slug: string }[];
}

export interface SellingAgentWizardProps {
  locale: string;
  categories?: CategoryItem[];
  locations?: LocationItem[];
}

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

export const URGENCY_OPTIONS = [
  {
    value: "ONE_DAY",
    label: "Sell today",
    color: "text-red-500",
    desc: "Aggressive pricing, max exposure",
  },
  {
    value: "THREE_DAYS",
    label: "Within 3 days",
    color: "text-orange-500",
    desc: "Fast but flexible",
  },
  {
    value: "ONE_WEEK",
    label: "This week",
    color: "text-yellow-500",
    desc: "Balanced approach",
  },
  {
    value: "TWO_WEEKS",
    label: "Within 2 weeks",
    color: "text-blue-500",
    desc: "Patient pricing",
  },
  {
    value: "ONE_MONTH",
    label: "This month",
    color: "text-green-500",
    desc: "Maximize price",
  },
  {
    value: "NO_RUSH",
    label: "No rush",
    color: "text-gray-500",
    desc: "Hold for best offer",
  },
];

export const SELLING_STEP_LABELS = [
  "photos",
  "details",
  "pricing",
  "agent",
  "launch",
] as const;

export const SELLING_STEP_MAP: Record<string, number> = {
  greeting: 0,
  photos: 0,
  analyzing: 0,
  confirm_details: 1,
  category: 1,
  pricing: 2,
  urgency: 2,
  agent_config: 3,
  strategy: 3,
  agent_proposal: 3,
  summary: 3,
  publishing: 4,
  done: 4,
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

export function resolveName(
  name: JsonName,
  locale: string,
  fallback: string,
): string {
  if (typeof name === "object") {
    return (
      (name as Record<string, string>)[locale] ||
      (name as Record<string, string>).en ||
      fallback
    );
  }
  return name as string;
}

/** Category keyword mapping for smart ordering based on item description */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  transport: [
    "car",
    "auto",
    "vehicle",
    "truck",
    "motorcycle",
    "bike",
    "bicycle",
    "boat",
    "tires",
    "wheels",
    "spare parts",
    "bmw",
    "audi",
    "toyota",
    "honda",
    "ford",
    "volkswagen",
    "vw",
    "mercedes",
    "volvo",
  ],
  "real-estate": [
    "apartment",
    "house",
    "flat",
    "room",
    "land",
    "property",
    "rent",
    "garage",
    "estate",
  ],
  electronics: [
    "phone",
    "laptop",
    "computer",
    "tablet",
    "tv",
    "television",
    "camera",
    "gaming",
    "console",
    "playstation",
    "xbox",
    "iphone",
    "samsung",
    "headphones",
    "speaker",
    "monitor",
  ],
  "home-garden": [
    "furniture",
    "sofa",
    "table",
    "chair",
    "bed",
    "kitchen",
    "garden",
    "tool",
    "drill",
    "appliance",
    "washing",
    "fridge",
    "oven",
    "lamp",
    "shelf",
    "wardrobe",
    "desk",
  ],
  fashion: [
    "dress",
    "shirt",
    "jacket",
    "coat",
    "shoes",
    "boots",
    "bag",
    "watch",
    "jewelry",
    "ring",
    "clothing",
    "jeans",
    "sneakers",
    "handbag",
  ],
  jobs: [
    "job",
    "work",
    "hiring",
    "vacancy",
    "position",
    "salary",
    "employment",
  ],
  services: [
    "repair",
    "service",
    "cleaning",
    "plumbing",
    "electrician",
    "moving",
    "tutoring",
    "lesson",
  ],
  "kids-baby": [
    "baby",
    "child",
    "kids",
    "stroller",
    "toy",
    "school",
    "diaper",
    "crib",
  ],
  "sports-outdoors": [
    "sport",
    "fitness",
    "gym",
    "ski",
    "snowboard",
    "camping",
    "hiking",
    "fishing",
    "hunting",
    "bicycle",
    "swimming",
    "running",
    "yoga",
    "tennis",
    "football",
    "basketball",
  ],
  pets: [
    "dog",
    "cat",
    "bird",
    "fish",
    "aquarium",
    "pet",
    "puppy",
    "kitten",
    "parrot",
    "hamster",
  ],
  "hobbies-leisure": [
    "book",
    "music",
    "guitar",
    "piano",
    "violin",
    "drum",
    "instrument",
    "record",
    "vinyl",
    "collectible",
    "antique",
    "board game",
    "puzzle",
    "art",
    "painting",
    "craft",
    "hobby",
    "ticket",
    "concert",
    "bass",
    "saxophone",
    "flute",
    "keyboard",
    "ukulele",
    "cello",
    "harmonica",
    "banjo",
    "mandolin",
    "gibson",
    "fender",
    "yamaha",
    "ibanez",
  ],
  agriculture: [
    "tractor",
    "farm",
    "seed",
    "harvest",
    "livestock",
    "animal feed",
    "agricultural",
  ],
};

/**
 * Sort categories by relevance to the item description.
 * Returns all categories, with best matches first.
 */
export function sortCategoriesByRelevance(
  categories: CategoryItem[],
  text: string,
  locale: string,
): CategoryItem[] {
  if (!text || text.trim().length === 0) return categories;

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  const scored = categories.map((cat) => {
    let score = 0;
    const slug = cat.slug;

    // Check keyword map for the category slug
    const keywords = CATEGORY_KEYWORDS[slug] || [];
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += kw.length > 4 ? 3 : 2; // longer keyword = stronger match
      }
    }

    // Check subcategory names
    if (cat.children) {
      for (const child of cat.children) {
        const childName = resolveName(
          child.name,
          locale,
          child.slug,
        ).toLowerCase();
        for (const word of words) {
          if (word.length > 2 && childName.includes(word)) {
            score += 2;
          }
        }
      }
    }

    // Check category name itself
    const catName = resolveName(cat.name, locale, slug).toLowerCase();
    for (const word of words) {
      if (word.length > 2 && catName.includes(word)) {
        score += 1;
      }
    }

    return { cat, score };
  });

  // Sort by score descending, keep original order for ties
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.cat);
}

/**
 * Build category action buttons with the best match highlighted.
 * Shows up to `limit` categories, sorted by relevance.
 * The top category gets a ⭐ prefix if it scored above 0.
 */
export function buildCategoryActions(
  categories: CategoryItem[],
  text: string,
  locale: string,
  limit = 8,
): ChatAction[] {
  if (!text || text.trim().length === 0) {
    return categories.slice(0, limit).map((c) => ({
      label: resolveName(c.name, locale, c.slug),
      value: `cat_${c.id}`,
    }));
  }

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  const scored = categories.map((cat) => {
    let score = 0;
    const slug = cat.slug;

    const keywords = CATEGORY_KEYWORDS[slug] || [];
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += kw.length > 4 ? 3 : 2;
      }
    }

    if (cat.children) {
      for (const child of cat.children) {
        const childName = resolveName(
          child.name,
          locale,
          child.slug,
        ).toLowerCase();
        for (const word of words) {
          if (word.length > 2 && childName.includes(word)) {
            score += 2;
          }
        }
      }
    }

    const catName = resolveName(cat.name, locale, slug).toLowerCase();
    for (const word of words) {
      if (word.length > 2 && catName.includes(word)) {
        score += 1;
      }
    }

    return { cat, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score ?? 0;

  return scored.slice(0, limit).map((s, i) => ({
    label:
      i === 0 && topScore > 0
        ? `⭐ ${resolveName(s.cat.name, locale, s.cat.slug)}`
        : resolveName(s.cat.name, locale, s.cat.slug),
    value: `cat_${s.cat.id}`,
  }));
}

// ──────────────────────────────────────────────
// STEP CONTEXT (passed to step handlers)
// ──────────────────────────────────────────────

export interface SellingStepContext {
  data: SellingWizardData;
  updateData: (updates: Partial<SellingWizardData>) => void;
  setCurrentStep: (step: SellingWizardStep) => void;
  addAgentMessage: (
    content: string,
    actions?: ChatAction[],
    component?: ReactNode,
  ) => void;
  addUserMessage: (content: string) => void;
  thinkAndRespond: (
    message: string,
    actions?: ChatAction[],
    component?: ReactNode,
  ) => Promise<void>;
  setIsThinking: (v: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  locale: string;
  categories: CategoryItem[];
  locations: LocationItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trpcUtils: any;
  fileInputRef: RefObject<HTMLInputElement | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}
