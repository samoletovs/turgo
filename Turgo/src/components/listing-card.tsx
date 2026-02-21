"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, Clock, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { ListingCardData } from "@/types";

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
  const imageUrl = listing.imageUrl || "/placeholder.svg";
  const linkHref = listing.slug
    ? `/${locale}/listing/${listing.slug}`
    : `/${locale}/listing/${listing.id}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg">
      {/* Image */}
      <Link href={linkHref} className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageUrl}
          alt={listing.title}
          fill
          unoptimized={imageUrl.startsWith("http")}
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        {/* Badges overlay */}
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.isFeatured && (
            <Badge variant="default" className="text-[10px]">
              Featured
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavoriteToggle(listing.id);
            }}
            className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white"
            aria-label={
              isFavorited ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-gray-600 hover:text-red-500"
              }`}
            />
          </button>
        )}

        {/* Image count */}
        {listing.imageCount && listing.imageCount > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {listing.imageCount} photos
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
          <p className="text-lg font-bold text-primary">
            {listing.price ? formatPrice(listing.price) : "Price negotiable"}
          </p>

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
