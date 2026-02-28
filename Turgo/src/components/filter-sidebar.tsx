"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/stores/useFilterStore";
import type { Condition } from "@/stores/useFilterStore";
import { PriceRangeFilter } from "@/components/filters/PriceRangeFilter";
import { DynamicAttributeFilter } from "@/components/filters/DynamicAttributeFilter";
export { MobileFilterTrigger } from "@/components/filters/MobileFilterTrigger";

// ─── Types ───────────────────────────────────────────────

export interface FilterCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  count: number;
  children?: FilterCategory[];
}

export interface CategorySpecificFilter {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN";
  options?: string[] | null;
  isRequired?: boolean;
}

export interface FilterValues {
  category?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: string;
  countryCode?: string;
  sort?: string;
  q?: string;
  [key: string]: string | undefined;
}

interface FilterSidebarProps {
  locale: string;
  categories: FilterCategory[];
  locations?: FilterCategory[];
  categoryAttributes?: CategorySpecificFilter[];
  currentFilters: FilterValues;
  totalResults: number;
  /** Called when filters change. If omitted, uses URL params. */
  onFilterChange?: (filters: FilterValues) => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────

export function FilterSidebar({
  locale,
  categories,
  locations = [],
  categoryAttributes = [],
  currentFilters,
  totalResults: _totalResults,
  onFilterChange,
  className,
}: FilterSidebarProps) {
  const t = useTranslations("common");
  const tb = useTranslations("browse");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["categories", "price", "condition"]),
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    currentFilters.category || null,
  );

  // Zustand filter store — sync URL filters into store
  const { viewMode, setViewMode, setFilter } = useFilterStore();

  // Rehydrate Zustand persisted state on mount
  useEffect(() => {
    useFilterStore.persist.rehydrate();
  }, []);

  // Keep store in sync with URL-driven currentFilters
  useEffect(() => {
    if (currentFilters.category) setFilter("category", currentFilters.category);
    if (currentFilters.condition)
      setFilter("condition", currentFilters.condition as Condition);
    if (currentFilters.location) setFilter("location", currentFilters.location);
    if (currentFilters.minPrice || currentFilters.maxPrice) {
      setFilter("priceRange", {
        min: currentFilters.minPrice,
        max: currentFilters.maxPrice,
      });
    }
  }, [currentFilters, setFilter]);

  // Toggle section accordion
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Apply a filter change via URL params
  const applyFilter = useCallback(
    (key: string, value: string | undefined) => {
      if (onFilterChange) {
        onFilterChange({ ...currentFilters, [key]: value, page: undefined });
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset to page 1
      router.push(`/${locale}/search?${params.toString()}`);
    },
    [currentFilters, locale, onFilterChange, router, searchParams],
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    if (onFilterChange) {
      onFilterChange({ q: currentFilters.q });
      return;
    }
    const params = new URLSearchParams();
    if (currentFilters.q) params.set("q", currentFilters.q);
    router.push(`/${locale}/search?${params.toString()}`);
  }, [currentFilters.q, locale, onFilterChange, router]);

  // Count of active filters (excluding q and sort)
  const activeFilterCount = Object.entries(currentFilters).filter(
    ([k, v]) => v && k !== "q" && k !== "sort" && k !== "page",
  ).length;

  return (
    <aside className={cn("w-64 shrink-0 space-y-1", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-sm font-semibold">{t("filter")}</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
            aria-label={tb("gridView")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
            aria-label={tb("listView")}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3 w-3" />
              {t("reset")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Categories ── */}
      <FilterSection
        title={tb("categories")}
        sectionKey="categories"
        expanded={expandedSections.has("categories")}
        onToggle={toggleSection}
      >
        <div className="space-y-0.5">
          {categories.map((cat) => (
            <div key={cat.id}>
              <button
                onClick={() => {
                  if (currentFilters.category === cat.slug) {
                    applyFilter("category", undefined);
                    setExpandedCategory(null);
                  } else {
                    applyFilter("category", cat.slug);
                    setExpandedCategory(cat.slug);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                  currentFilters.category === cat.slug &&
                    "bg-muted font-medium text-primary",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {cat.icon && <span className="text-xs">{cat.icon}</span>}
                  {cat.name}
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] px-1">
                    {cat.count}
                  </Badge>
                  {cat.children &&
                    cat.children.length > 0 &&
                    (expandedCategory === cat.slug ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    ))}
                </span>
              </button>

              {/* Subcategories */}
              {cat.children && expandedCategory === cat.slug && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
                  {cat.children.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() =>
                        applyFilter(
                          "category",
                          currentFilters.category === sub.slug
                            ? cat.slug
                            : sub.slug,
                        )
                      }
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted",
                        currentFilters.category === sub.slug &&
                          "bg-muted font-medium text-primary",
                      )}
                    >
                      <span>{sub.name}</span>
                      <Badge variant="secondary" className="text-[9px] px-1">
                        {sub.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </FilterSection>

      {/* ── Price Range ── */}
      <FilterSection
        title={tb("priceRange")}
        sectionKey="price"
        expanded={expandedSections.has("price")}
        onToggle={toggleSection}
      >
        <PriceRangeFilter
          key={`${currentFilters.minPrice}-${currentFilters.maxPrice}`}
          minPrice={currentFilters.minPrice}
          maxPrice={currentFilters.maxPrice}
          onApply={(min, max) => {
            if (onFilterChange) {
              onFilterChange({
                ...currentFilters,
                minPrice: min || undefined,
                maxPrice: max || undefined,
                page: undefined,
              });
              return;
            }
            const params = new URLSearchParams(searchParams.toString());
            if (min) params.set("minPrice", min);
            else params.delete("minPrice");
            if (max) params.set("maxPrice", max);
            else params.delete("maxPrice");
            params.delete("page");
            router.push(`/${locale}/search?${params.toString()}`);
          }}
        />
      </FilterSection>

      {/* ── Condition ── */}
      <FilterSection
        title={tb("condition")}
        sectionKey="condition"
        expanded={expandedSections.has("condition")}
        onToggle={toggleSection}
      >
        <div className="space-y-0.5">
          {(["NEW", "USED", "REFURBISHED"] as const).map((cond) => (
            <button
              key={cond}
              onClick={() =>
                applyFilter(
                  "condition",
                  currentFilters.condition === cond ? undefined : cond,
                )
              }
              className={cn(
                "flex w-full items-center rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                currentFilters.condition === cond &&
                  "bg-muted font-medium text-primary",
              )}
            >
              {cond === "NEW"
                ? tb("new")
                : cond === "USED"
                  ? tb("used")
                  : tb("refurbished")}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* ── Location ── */}
      {locations.length > 0 && (
        <FilterSection
          title={tb("location")}
          sectionKey="location"
          expanded={expandedSections.has("location")}
          onToggle={toggleSection}
        >
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() =>
                  applyFilter(
                    "location",
                    currentFilters.location === loc.slug ? undefined : loc.slug,
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                  currentFilters.location === loc.slug &&
                    "bg-muted font-medium text-primary",
                )}
              >
                <span>{loc.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {loc.count}
                </Badge>
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* ── Country ── */}
      <FilterSection
        title={tb("country")}
        sectionKey="country"
        expanded={expandedSections.has("country")}
        onToggle={toggleSection}
      >
        <div className="space-y-0.5">
          {[
            { code: "LV", name: "Latvia 🇱🇻" },
            { code: "LT", name: "Lithuania 🇱🇹" },
            { code: "EE", name: "Estonia 🇪🇪" },
          ].map((country) => (
            <button
              key={country.code}
              onClick={() =>
                applyFilter(
                  "countryCode",
                  currentFilters.countryCode === country.code
                    ? undefined
                    : country.code,
                )
              }
              className={cn(
                "flex w-full items-center rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                currentFilters.countryCode === country.code &&
                  "bg-muted font-medium text-primary",
              )}
            >
              {country.name}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* ── Category-specific dynamic filters ── */}
      {categoryAttributes.length > 0 && (
        <FilterSection
          title={tb("specifications")}
          sectionKey="attributes"
          expanded={expandedSections.has("attributes")}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            {categoryAttributes.map((attr) => (
              <DynamicAttributeFilter
                key={attr.id}
                attribute={attr}
                value={currentFilters[`attr_${attr.id}`]}
                onChange={(val) => applyFilter(`attr_${attr.id}`, val)}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </aside>
  );
}

// ─── Sub-components ──────────────────────────────────────

function FilterSection({
  title,
  sectionKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t pt-3 pb-2">
      <button
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between pb-2 text-sm font-semibold"
      >
        {title}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {expanded && children}
    </div>
  );
}
