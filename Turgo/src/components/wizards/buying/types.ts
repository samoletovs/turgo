import type { Dispatch, SetStateAction } from "react";

// ──────────────────────────────────────────────
// STEP & DATA TYPES
// ──────────────────────────────────────────────

export type BuyingWizardStep =
  | "greeting"
  | "describe_want"
  | "category"
  | "budget"
  | "location"
  | "condition"
  | "features"
  | "agent_config"
  | "summary"
  | "creating"
  | "done";

export interface ChatAction {
  label: string;
  value: string;
}

export interface ChatMsg {
  id: string;
  role: "agent" | "user";
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
  { value: "ANY", label: "Any condition", desc: "New or used" },
  { value: "NEW", label: "New only", desc: "Sealed / unused" },
  { value: "USED", label: "Used is fine", desc: "Good condition" },
];

export const MONITOR_FREQ = [
  { value: "5", label: "Every 5 min", desc: "Never miss a deal" },
  { value: "15", label: "Every 15 min", desc: "Frequent checks" },
  { value: "60", label: "Hourly", desc: "Balanced" },
  { value: "1440", label: "Daily digest", desc: "Once a day" },
];

export const BUYING_STEP_LABELS = [
  "search",
  "budget",
  "location",
  "config",
  "launch",
] as const;

export const BUYING_STEP_MAP: Record<string, number> = {
  greeting: 0,
  describe_want: 0,
  category: 1,
  budget: 1,
  location: 2,
  condition: 2,
  features: 3,
  agent_config: 3,
  summary: 4,
  creating: 4,
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
}
