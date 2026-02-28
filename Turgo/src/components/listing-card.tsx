"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Heart, MapPin, Clock, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { ListingCardData } from "@/types";

/** Tiny 4×3 teal-gradient placeholder encoded as base64 data URL */
const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAL0lEQVQIHQEkANv/AMXW4K/K2LbO27zR3gCKrbqIqqiHqqeJq60AUoGRV4WTWoeUcA4Wx7JlpYIAAAAASUVORK5CYII=";

/**
 * Format price with tabular-nums style: "849 EUR" instead of "€849"
 */
function formatCardPrice(
  price: number | { toNumber(): number } | string,
  currency = "EUR",
  locale = "en",
): { amount: string; suffix: string } {
  const numericPrice = typeof price === "number" ? price : Number(price);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(numericPrice);
  return { amount: formatted, suffix: currency };
}

interface ListingCardProps {
  listing: ListingCardData;
  locale?: string;
  onFavoriteToggle?: (id: string) => void;
  isFavorited?: boolean;
}

export function ListingCard({
  listing,
  locale = "en",
  onFavoriteToggle,
  isFavorited = false,
}: ListingCardProps) {
  const t = useTranslations("listing");
  const [justFavorited, setJustFavorited] = useState(false);
  const imageUrl = listing.imageUrl || "/placeholder.svg";
  const linkHref = listing.slug
    ? `/listing/${listing.slug}`
    : `/listing/${listing.id}`;

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFavorited) {
      setJustFavorited(true);
      setTimeout(() => setJustFavorited(false), 600);
    }
    onFavoriteToggle?.(listing.id);
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5">
      {/* Image */}
      <Link href={linkHref} className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageUrl}
          alt={listing.title}
          fill
          unoptimized={imageUrl.startsWith("http")}
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
        />

        {/* Gradient overlay for readability */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Badges overlay */}
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.isFeatured && (
            <Badge variant="default" className="text-[10px]">
              {t("featured")}
            </Badge>
          )}
          {listing.hasAgent && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Bot className="h-3 w-3" /> AI
            </Badge>
          )}
        </div>

        {/* Favorite button */}
        {onFavoriteToggle && (
          <button
            onClick={handleFavoriteToggle}
            className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white"
            aria-label={isFavorited ? t("unfavorite") : t("favorite")}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-gray-600 hover:text-red-500"
              } ${isFavorited ? "animate-heart-bounce" : ""}`}
            />
            {/* Particle burst on favorite */}
            {justFavorited && (
              <span
                className="pointer-events-none absolute inset-0 animate-heart-burst"
                aria-hidden="true"
              />
            )}
          </button>
        )}

        {/* Image count */}
        {listing.imageCount && listing.imageCount > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {listing.imageCount} {t("photos")}
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <Link href={linkHref}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
            {listing.title}
          </h3>
        </Link>

        <div className="mt-auto pt-2">
          {/* Price */}
          {listing.price ? (
            <p
              className="text-lg font-bold text-primary"
              style={{ fontFeatureSettings: '"tnum" 1' }}
            >
              {formatCardPrice(listing.price, listing.currency, locale).amount}
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                {
                  formatCardPrice(listing.price, listing.currency, locale)
                    .suffix
                }
              </span>
            </p>
          ) : (
            <p className="text-lg font-bold text-primary">{t("negotiable")}</p>
          )}

          {/* Location + time */}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {listing.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {listing.location}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(listing.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton placeholder — mirrors card layout with pulse animations  */
/* ------------------------------------------------------------------ */

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      {/* Image placeholder */}
      <div className="aspect-[4/3] bg-muted animate-pulse" />

      {/* Content placeholder */}
      <div className="flex flex-1 flex-col p-3 gap-2">
        {/* Title lines */}
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />

        <div className="mt-auto pt-2 space-y-2">
          {/* Price */}
          <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
          {/* Location */}
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
