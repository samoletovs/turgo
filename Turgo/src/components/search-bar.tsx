"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Tag, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface Suggestion {
  text: string;
  type: "listing" | "category";
  slug?: string;
}

interface SearchBarProps {
  locale: string;
  /** Initial query value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in ms (default 300) */
  debounceMs?: number;
  /** Called on submit */
  onSearch?: (query: string) => void;
  /** Additional class on the wrapper */
  className?: string;
  /** Show in compact mode for navbar */
  compact?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

// ─── Component ───────────────────────────────────────────

export function SearchBar({
  locale,
  defaultValue = "",
  placeholder = "Search listings...",
  debounceMs = 300,
  onSearch,
  className,
  compact = false,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Debounced fetch suggestions
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data: Suggestion[] = await res.json();
          setSuggestions(data);
          setIsOpen(data.length > 0);
        }
      } catch {
        // Fallback: keep existing suggestions
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const submit = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setIsOpen(false);
      if (onSearch) {
        onSearch(q);
      } else {
        router.push(`/${locale}/search?q=${encodeURIComponent(q)}`);
      }
    },
    [locale, onSearch, router],
  );

  const selectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      setIsOpen(false);
      if (suggestion.type === "category" && suggestion.slug) {
        router.push(`/${locale}/search?category=${suggestion.slug}`);
      } else {
        setQuery(suggestion.text);
        submit(suggestion.text);
      }
    },
    [locale, router, submit],
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit(query);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          submit(query);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="relative flex"
      >
        <div className="relative flex-1">
          <Search
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
          />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="search-listbox"
            aria-activedescendant={
              isOpen && selectedIndex >= 0
                ? `search-option-${selectedIndex}`
                : undefined
            }
            className={cn(
              "pr-8",
              compact ? "h-9 pl-9 text-sm" : "h-11 pl-10 text-base",
              isOpen && "rounded-b-none",
            )}
          />
          {/* Clear / Loading indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {/* Visually hidden live region for screen reader announcements */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {isOpen && suggestions.length > 0
          ? `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} available`
          : ""}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 rounded-b-lg border border-t-0 bg-popover shadow-lg"
        >
          <ul
            id="search-listbox"
            role="listbox"
            aria-label="Search suggestions"
            className="py-1"
          >
            {suggestions.map((s, i) => (
              <li
                key={`${s.type}-${s.text}-${i}`}
                id={`search-option-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <button
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  tabIndex={-1}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                    i === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  {s.type === "category" ? (
                    <Tag className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-left">{s.text}</span>
                  {s.type === "category" && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      Category
                    </span>
                  )}
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>

          {/* Search for exact query */}
          <div className="border-t px-3 py-2">
            <button
              onClick={() => submit(query)}
              className="flex w-full items-center gap-2 text-sm text-primary hover:underline"
            >
              <Search className="h-3.5 w-3.5" />
              Search for &ldquo;{query}&rdquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
