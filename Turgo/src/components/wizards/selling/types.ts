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
  | "summary"
  | "publishing"
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
}
