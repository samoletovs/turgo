import type { Dispatch, SetStateAction } from 'react';

// ──────────────────────────────────────────────
// STEP & DATA TYPES
// ──────────────────────────────────────────────

export type BuyingWizardStep =
  | 'greeting'
  | 'describe_want'
  | 'category'
  | 'budget'
  | 'location'
  | 'condition'
  | 'features'
  | 'agent_config'
  | 'strategy'
  | 'agent_proposal'
  | 'summary'
  | 'creating'
  | 'done';

export interface ChatAction {
  label: string;
  value: string;
  desc?: string;
}

export interface ChatMsg {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface BuyingWizardData {
  searchQuery: string;
  categoryId: string;
  categoryName: string;
  maxPrice: number;
  idealPrice: number;
  locationId: string;
  locationName: string;
  condition: string;
  features: string[];
  monitorFrequency: number;
  autoOffer: boolean;
  autoNegotiate: boolean;
  dealScoreThreshold: number;
  buyingStrategyId: 'TIME_ESCALATION' | 'MAX_BID' | 'SNIPER' | 'ACCEPT_LISTED' | 'EARLY_BIRD';
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

export interface BuyingAgentWizardProps {
  locale: string;
  categories?: CategoryItem[];
  locations?: LocationItem[];
}

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

export const CONDITION_OPTIONS = [
  { value: 'ANY', label: 'Any condition', desc: 'New or used' },
  { value: 'NEW', label: 'New only', desc: 'Sealed / unused' },
  { value: 'USED', label: 'Used is fine', desc: 'Good condition' },
];

export const MONITOR_FREQ = [
  { value: '5', label: 'Every 5 min', desc: 'Never miss a deal' },
  { value: '15', label: 'Every 15 min', desc: 'Frequent checks' },
  { value: '60', label: 'Hourly', desc: 'Balanced' },
  { value: '1440', label: 'Daily digest', desc: 'Once a day' },
];

export const BUYING_STEP_LABELS = ['search', 'budget', 'location', 'config', 'launch'] as const;

export const BUYING_STEP_MAP: Record<string, number> = {
  greeting: 0,
  describe_want: 0,
  category: 1,
  budget: 1,
  location: 2,
  condition: 2,
  features: 3,
  agent_config: 3,
  strategy: 3,
  agent_proposal: 3,
  summary: 4,
  creating: 4,
  done: 4,
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

export function resolveName(name: JsonName, locale: string, fallback: string): string {
  if (typeof name === 'object') {
    return (
      (name as Record<string, string>)[locale] || (name as Record<string, string>).en || fallback
    );
  }
  return name as string;
}

/** Category keyword mapping for smart ordering based on search query */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  transport: [
    'car',
    'auto',
    'vehicle',
    'truck',
    'motorcycle',
    'bike',
    'bicycle',
    'boat',
    'bmw',
    'audi',
    'toyota',
    'honda',
    'ford',
    'volkswagen',
    'vw',
    'mercedes',
    'volvo',
  ],
  'real-estate': [
    'apartment',
    'house',
    'flat',
    'room',
    'land',
    'property',
    'rent',
    'garage',
    'estate',
  ],
  electronics: [
    'phone',
    'laptop',
    'computer',
    'tablet',
    'tv',
    'television',
    'camera',
    'gaming',
    'console',
    'playstation',
    'xbox',
    'iphone',
    'samsung',
    'headphones',
    'speaker',
    'monitor',
  ],
  'home-garden': [
    'furniture',
    'sofa',
    'table',
    'chair',
    'bed',
    'kitchen',
    'garden',
    'tool',
    'drill',
    'appliance',
    'washing',
    'fridge',
    'oven',
  ],
  fashion: [
    'dress',
    'shirt',
    'jacket',
    'coat',
    'shoes',
    'boots',
    'bag',
    'watch',
    'jewelry',
    'clothing',
    'jeans',
    'sneakers',
  ],
  jobs: ['job', 'work', 'hiring', 'vacancy', 'position', 'salary'],
  services: ['repair', 'service', 'cleaning', 'plumbing', 'electrician', 'moving', 'tutoring'],
  'kids-baby': ['baby', 'child', 'kids', 'stroller', 'toy', 'school', 'diaper'],
  'sports-outdoors': [
    'sport',
    'fitness',
    'gym',
    'ski',
    'snowboard',
    'camping',
    'hiking',
    'fishing',
    'swimming',
    'running',
    'tennis',
    'football',
  ],
  pets: ['dog', 'cat', 'bird', 'fish', 'aquarium', 'pet', 'puppy', 'kitten'],
  'hobbies-leisure': [
    'book',
    'music',
    'guitar',
    'piano',
    'violin',
    'drum',
    'instrument',
    'record',
    'vinyl',
    'collectible',
    'antique',
    'board game',
    'puzzle',
    'art',
    'painting',
    'craft',
    'hobby',
    'ticket',
    'concert',
    'gibson',
    'fender',
    'yamaha',
  ],
  agriculture: ['tractor', 'farm', 'seed', 'harvest', 'livestock', 'agricultural'],
};

/**
 * Sort categories by relevance to the search query.
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

    const keywords = CATEGORY_KEYWORDS[slug] || [];
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += kw.length > 4 ? 3 : 2;
      }
    }

    if (cat.children) {
      for (const child of cat.children) {
        const childName = resolveName(child.name, locale, child.slug).toLowerCase();
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
  return scored.map((s) => s.cat);
}

/**
 * Build category action buttons with the best match highlighted.
 */
export function buildCategoryActions(
  categories: CategoryItem[],
  text: string,
  locale: string,
  limit = 8,
): { label: string; value: string }[] {
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
        const childName = resolveName(child.name, locale, child.slug).toLowerCase();
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

export interface BuyingStepContext {
  data: BuyingWizardData;
  updateData: (updates: Partial<BuyingWizardData>) => void;
  setCurrentStep: (step: BuyingWizardStep) => void;
  addAgentMessage: (content: string, actions?: ChatAction[]) => void;
  addUserMessage: (content: string) => void;
  thinkAndRespond: (message: string, actions?: ChatAction[]) => Promise<void>;
  setIsThinking: (v: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>;
  locale: string;
  categories: CategoryItem[];
  locations: LocationItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBuyingAgent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trpcUtils: any;
  t: (key: string, params?: Record<string, string | number>) => string;
}
