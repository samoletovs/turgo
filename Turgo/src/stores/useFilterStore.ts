import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────

export type ViewMode = "grid" | "list";
export type SortBy =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "relevance";
export type Condition = "NEW" | "USED" | "REFURBISHED";

export interface PriceRange {
  min?: string;
  max?: string;
}

export interface FilterState {
  category?: string;
  priceRange: PriceRange;
  condition?: Condition;
  location?: string;
  sortBy: SortBy;
  viewMode: ViewMode;
  page: number;
}

export interface FilterActions {
  setFilter: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  resetFilters: () => void;
  setViewMode: (mode: ViewMode) => void;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  category: undefined,
  priceRange: {},
  condition: undefined,
  location: undefined,
  sortBy: "newest",
  viewMode: "grid",
  page: 1,
};

// ─── Store ───────────────────────────────────────────────

export const useFilterStore = create<FilterState & FilterActions>()(
  persist(
    (set) => ({
      ...DEFAULT_FILTERS,

      setFilter: (key, value) =>
        set((state) => ({
          ...state,
          [key]: value,
          // Reset to page 1 when any filter changes (except page itself)
          ...(key !== "page" ? { page: 1 } : {}),
        })),

      resetFilters: () =>
        set((state) => ({
          ...DEFAULT_FILTERS,
          // Preserve viewMode across resets
          viewMode: state.viewMode,
        })),

      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: "turgo-filter-store",
      // Only persist viewMode to localStorage
      partialize: (state) => ({ viewMode: state.viewMode }),
    },
  ),
);
