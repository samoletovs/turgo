"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  Grid3X3,
  List,
  Map,
  Bot,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  X,
  MapPin,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListingCard } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import {
  FilterSidebar,
  MobileFilterTrigger,
  type FilterCategory,
  type CategorySpecificFilter,
  type FilterValues,
} from "@/components/filter-sidebar";
import { cn, formatPrice, formatRelativeTime } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface SerializedListing {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  condition: string;
  description: string;
  location: string;
  locationSlug?: string;
  imageUrl: string;
  imageCount: number;
  createdAt: string;
  isFeatured: boolean;
  hasAgent: boolean;
  categoryName: string;
  favoriteCount: number;
  latitude?: number | null;
  longitude?: number | null;
  viewCount: number;
}

interface SearchPageClientProps {
  locale: string;
  listings: SerializedListing[];
  categories: FilterCategory[];
  locations: FilterCategory[];
  categoryAttributes: CategorySpecificFilter[];
  filters: Record<string, string | undefined>;
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

type ViewMode = "grid" | "list" | "map";

// ─── Component ───────────────────────────────────────────

export function SearchPageClient({
  locale,
  listings,
  categories,
  locations,
  categoryAttributes,
  filters,
  totalCount,
  totalPages,
  currentPage,
}: SearchPageClientProps) {
  const _t = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>(
    (filters.view as ViewMode) || "grid",
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Build URL with updated params
  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      return `/search?${params.toString()}`;
    },
    [searchParams],
  );

  // Sort handler
  const handleSort = (sort: string) => {
    router.push(buildUrl({ sort, page: undefined }));
  };

  // View mode handler
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    router.push(buildUrl({ view: mode }));
  };

  // Active filter count
  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && !["q", "sort", "page", "view"].includes(k),
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Search Header */}
      <div className="mb-6">
        <SearchBar
          locale={locale}
          defaultValue={filters.q || ""}
          placeholder="Search for anything..."
          autoFocus={!filters.q}
        />
      </div>

      <div className="flex gap-6">
        {/* Desktop Sidebar */}
        <FilterSidebar
          locale={locale}
          categories={categories}
          locations={locations}
          categoryAttributes={categoryAttributes}
          currentFilters={filters as FilterValues}
          totalResults={totalCount}
          className="hidden lg:block"
        />

        {/* Mobile filter sheet */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 top-0 w-80 overflow-y-auto bg-background p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Filters</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FilterSidebar
                locale={locale}
                categories={categories}
                locations={locations}
                categoryAttributes={categoryAttributes}
                currentFilters={filters as FilterValues}
                totalResults={totalCount}
              />
            </div>
          </div>
        )}

        {/* Results Area */}
        <div className="min-w-0 flex-1">
          {/* Results Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {totalCount}
                </span>{" "}
                {totalCount === 1 ? "result" : "results"}
                {filters.q && (
                  <span>
                    {" "}
                    for &ldquo;<span className="font-medium">{filters.q}</span>
                    &rdquo;
                  </span>
                )}
              </p>

              {/* Mobile filter trigger */}
              <MobileFilterTrigger
                activeCount={activeFilterCount}
                onClick={() => setMobileFiltersOpen(true)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Save search button */}
              <SaveSearchButton
                filters={filters}
                open={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
              />

              {/* Sort */}
              <select
                value={filters.sort || "newest"}
                onChange={(e) => handleSort(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="views">Most viewed</option>
              </select>

              {/* View toggle */}
              <div className="flex rounded-md border">
                {(
                  [
                    { mode: "grid" as ViewMode, icon: Grid3X3, label: "Grid" },
                    { mode: "list" as ViewMode, icon: List, label: "List" },
                    { mode: "map" as ViewMode, icon: Map, label: "Map" },
                  ] as const
                ).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => handleViewChange(mode)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                      viewMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      mode === "grid" && "rounded-l-md",
                      mode === "map" && "rounded-r-md",
                    )}
                    title={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {filters.category && (
                <FilterChip
                  label={`Category: ${filters.category}`}
                  onRemove={() =>
                    router.push(buildUrl({ category: undefined }))
                  }
                />
              )}
              {filters.location && (
                <FilterChip
                  label={`Location: ${filters.location}`}
                  onRemove={() =>
                    router.push(buildUrl({ location: undefined }))
                  }
                />
              )}
              {filters.condition && (
                <FilterChip
                  label={`Condition: ${filters.condition}`}
                  onRemove={() =>
                    router.push(buildUrl({ condition: undefined }))
                  }
                />
              )}
              {filters.minPrice && (
                <FilterChip
                  label={`Min: €${filters.minPrice}`}
                  onRemove={() =>
                    router.push(buildUrl({ minPrice: undefined }))
                  }
                />
              )}
              {filters.maxPrice && (
                <FilterChip
                  label={`Max: €${filters.maxPrice}`}
                  onRemove={() =>
                    router.push(buildUrl({ maxPrice: undefined }))
                  }
                />
              )}
              {filters.countryCode && (
                <FilterChip
                  label={`Country: ${filters.countryCode}`}
                  onRemove={() =>
                    router.push(buildUrl({ countryCode: undefined }))
                  }
                />
              )}
            </div>
          )}

          {/* ── Listings ── */}
          {listings.length === 0 ? (
            <EmptyState query={filters.q} locale={locale} />
          ) : viewMode === "map" ? (
            <MapView listings={listings} locale={locale} />
          ) : viewMode === "list" ? (
            <ListView listings={listings} locale={locale} />
          ) : (
            <GridView listings={listings} locale={locale} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              buildUrl={(p) => buildUrl({ page: String(p) })}
            />
          )}

          {/* ── Agent CTA ── */}
          <AgentPromptBanner
            locale={locale}
            query={filters.q}
            filters={filters}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Grid View ───────────────────────────────────────────

function GridView({
  listings,
  locale,
}: {
  listings: SerializedListing[];
  locale: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={{
            id: listing.id,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            location: listing.location,
            imageUrl: listing.imageUrl,
            imageCount: listing.imageCount,
            createdAt: new Date(listing.createdAt),
            isFeatured: listing.isFeatured,
            hasAgent: listing.hasAgent,
            slug: listing.slug,
          }}
          locale={locale}
        />
      ))}
    </div>
  );
}

// ─── List View ───────────────────────────────────────────

function ListView({
  listings,
  locale,
}: {
  listings: SerializedListing[];
  locale: string;
}) {
  return (
    <div className="space-y-3">
      {listings.map((listing) => (
        <Link
          key={listing.id}
          href={`/listing/${listing.slug}`}
          className="group flex gap-4 rounded-xl border bg-card p-3 transition-all hover:shadow-md"
        >
          {/* Image */}
          <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            {listing.isFeatured && (
              <Badge
                variant="default"
                className="absolute left-1.5 top-1.5 text-[10px]"
              >
                Featured
              </Badge>
            )}
            {listing.hasAgent && (
              <Badge
                variant="secondary"
                className="absolute left-1.5 bottom-1.5 gap-0.5 text-[10px]"
              >
                <Bot className="h-3 w-3" /> AI
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 text-sm font-semibold group-hover:text-primary">
                  {listing.title}
                </h3>
                <span className="shrink-0 text-lg font-bold text-primary">
                  {formatPrice(listing.price, listing.currency)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {listing.description}
              </p>
            </div>

            <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                <Badge variant="outline" className="text-[10px] px-1">
                  {listing.condition.charAt(0) +
                    listing.condition.slice(1).toLowerCase()}
                </Badge>
              </span>
              {listing.categoryName && (
                <span className="inline-flex items-center gap-0.5 text-[11px]">
                  {listing.categoryName}
                </span>
              )}
              {listing.location && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" /> {listing.location}
                </span>
              )}
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" />{" "}
                {formatRelativeTime(new Date(listing.createdAt))}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Eye className="h-3 w-3" /> {listing.viewCount}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Map View (Leaflet) ──────────────────────────────────

function MapView({
  listings,
  locale,
}: {
  listings: SerializedListing[];
  locale: string;
}) {
  // Filter listings that have coordinates
  const geoListings = listings.filter(
    (l) => l.latitude != null && l.longitude != null,
  );

  // Fallback center: Riga, Latvia
  const defaultCenter = { lat: 56.9496, lng: 24.1052 };

  const center =
    geoListings.length > 0
      ? {
          lat:
            geoListings.reduce((s, l) => s + (l.latitude || 0), 0) /
            geoListings.length,
          lng:
            geoListings.reduce((s, l) => s + (l.longitude || 0), 0) /
            geoListings.length,
        }
      : defaultCenter;

  return (
    <div className="space-y-4">
      {geoListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-16 text-center">
          <Map className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-sm font-medium">No map data available</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            These listings don&apos;t have location coordinates. Try switching
            to grid or list view.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/search?${new URLSearchParams({ ...Object.fromEntries(Object.entries({}).filter(([, v]) => v)), view: "grid" }).toString()}`}
              >
                <Grid3X3 className="h-3.5 w-3.5 mr-1" /> Grid View
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Leaflet map container — loaded dynamically */}
          <LeafletMap listings={geoListings} center={center} locale={locale} />

          {/* Listing cards below map */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {geoListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={{
                  id: listing.id,
                  title: listing.title,
                  price: listing.price,
                  currency: listing.currency,
                  location: listing.location,
                  imageUrl: listing.imageUrl,
                  imageCount: listing.imageCount,
                  createdAt: new Date(listing.createdAt),
                  isFeatured: listing.isFeatured,
                  hasAgent: listing.hasAgent,
                  slug: listing.slug,
                }}
                locale={locale}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Leaflet Map (CSR only) ─────────────────────────────

function LeafletMap({
  listings,
  center,
  locale,
}: {
  listings: SerializedListing[];
  center: { lat: number; lng: number };
  locale: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = listings.find((l) => l.id === selectedId);

  return (
    <div className="relative overflow-hidden rounded-xl border">
      {/* We use an iframe-free approach: the map div + Leaflet CSS/JS loaded via script tag */}
      <div className="relative h-[450px] w-full bg-muted">
        <LeafletMapInner
          listings={listings}
          center={center}
          onMarkerClick={setSelectedId}
        />
      </div>

      {/* Selected listing popup */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] sm:left-auto sm:w-80">
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <button
                onClick={() => setSelectedId(null)}
                className="absolute right-2 top-2 rounded-full bg-background p-1 shadow-sm hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
              <Link href={`/listing/${selected.slug}`} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.imageUrl}
                  alt={selected.title}
                  className="h-16 w-20 rounded-md object-cover"
                />
                <div>
                  <h4 className="line-clamp-1 text-sm font-medium">
                    {selected.title}
                  </h4>
                  <p className="text-sm font-bold text-primary">
                    {formatPrice(selected.price, selected.currency)}
                  </p>
                  {selected.location && (
                    <p className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {selected.location}
                    </p>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Renders the actual Leaflet map using dynamic import */
function LeafletMapInner({
  listings,
  center,
  onMarkerClick,
}: {
  listings: SerializedListing[];
  center: { lat: number; lng: number };
  onMarkerClick: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return;

    // Dynamically load Leaflet
    const loadLeaflet = async () => {
      // Add Leaflet CSS if not present
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Dynamic import
      const L = await import("leaflet");

      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as Record<string, any>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapRef.current) return;

      const map = L.map(mapRef.current).setView([center.lat, center.lng], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // Add markers
      const bounds: [number, number][] = [];
      for (const listing of listings) {
        if (listing.latitude == null || listing.longitude == null) continue;
        const pos: [number, number] = [listing.latitude, listing.longitude];
        bounds.push(pos);

        const marker = L.marker(pos).addTo(map);
        marker.bindTooltip(
          `<strong>${listing.title}</strong><br>${formatPrice(listing.price, listing.currency)}`,
          { direction: "top" },
        );
        marker.on("click", () => onMarkerClick(listing.id));
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapInstanceRef.current = map;
    };

    loadLeaflet().catch(console.error);

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  return <div ref={mapRef} className="h-full w-full" />;
}

// ─── Save Search Dialog ──────────────────────────────────

function SaveSearchButton({
  filters,
  open,
  onOpenChange,
}: {
  filters: Record<string, string | undefined>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [emailNotify, setEmailNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/trpc/search.saveSearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            name: name.trim(),
            filters: Object.fromEntries(
              Object.entries(filters).filter(([, v]) => v),
            ),
            notifyEmail: emailNotify,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => {
        onOpenChange(false);
        setSaved(false);
        setName("");
      }, 1500);
    } catch {
      // Handle silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Save Search</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Save This Search</h3>
            <p className="text-sm text-muted-foreground">
              Get notified when new listings match your criteria.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="search-name">Search Name</Label>
              <Input
                id="search-name"
                placeholder="e.g., BMW X5 under €25K in Riga"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="email-notify"
                checked={emailNotify}
                onChange={(e) => setEmailNotify(e.target.checked)}
                className="rounded border"
              />
              <Label htmlFor="email-notify" className="text-sm">
                Email me when new matches are found
              </Label>
            </div>

            {/* Show active filters summary */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Your search criteria:
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(filters)
                  .filter(
                    ([k, v]) => v && !["page", "view", "sort"].includes(k),
                  )
                  .map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {k}: {v}
                    </Badge>
                  ))}
                {Object.entries(filters).filter(
                  ([k, v]) => v && !["page", "view", "sort"].includes(k),
                ).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    All listings
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saved ? (
                <>
                  <BookmarkCheck className="mr-1 h-4 w-4" /> Saved!
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                <>
                  <Bookmark className="mr-1 h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty State ─────────────────────────────────────────

function EmptyState({ query, locale }: { query?: string; locale: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Search className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">No results found</h3>
      <p className="mb-6 text-muted-foreground">
        {query
          ? `No listings match "${query}". Try adjusting your search or filters.`
          : "Try adjusting your filter criteria."}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <Link href="/search">
            <RotateCcw className="mr-1 h-4 w-4" /> Clear Filters
          </Link>
        </Button>
        <Button asChild>
          <Link href="/sell">
            <Sparkles className="mr-1 h-4 w-4" /> Sell Something
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Agent Prompt Banner ─────────────────────────────────

function AgentPromptBanner({
  locale,
  query,
  filters,
}: {
  locale: string;
  query?: string;
  filters: Record<string, string | undefined>;
}) {
  return (
    <Card className="mt-8 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-sm font-semibold">
            {query
              ? `Let an AI agent find "${query}" for you`
              : "Let an AI agent find the best deals for you"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set your criteria and our buying agent will monitor 24/7, alert you
            on great deals, and even negotiate on your behalf.
          </p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5" asChild>
          <Link
            href={`/dashboard/agents?action=create-buying${
              query ? `&keywords=${encodeURIComponent(query)}` : ""
            }${filters.category ? `&category=${filters.category}` : ""}${
              filters.maxPrice ? `&maxPrice=${filters.maxPrice}` : ""
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Create Buying Agent
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Pagination ──────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  buildUrl,
}: {
  currentPage: number;
  totalPages: number;
  buildUrl: (page: number) => string;
}) {
  // Generate page numbers to show
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="mt-8 flex items-center justify-center gap-1">
      {currentPage > 1 && (
        <Link href={buildUrl(currentPage - 1)}>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`dots-${i}`}
            className="px-2 text-sm text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <Link key={p} href={buildUrl(p)}>
            <Button
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-xs"
            >
              {p}
            </Button>
          </Link>
        ),
      )}

      {currentPage < totalPages && (
        <Link href={buildUrl(currentPage + 1)}>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
      {label}
      <button onClick={onRemove} className="hover:text-primary/70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
