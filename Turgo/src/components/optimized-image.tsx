"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  fallback?: string;
  aspectRatio?: string;
}

/**
 * Optimized image component with:
 * - WebP format via Next.js Image optimization
 * - srcset responsive sizing
 * - Lazy loading by default
 * - Loading skeleton placeholder
 * - Error fallback
 */
export function OptimizedImage({
  src,
  alt,
  fallback,
  className,
  aspectRatio,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError && fallback) {
    return (
      <Image
        src={fallback}
        alt={alt}
        className={className}
        loading="lazy"
        {...props}
      />
    );
  }

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground text-sm",
          className
        )}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <span>{alt}</span>
      </div>
    );
  }

  return (
    <div className="relative" style={aspectRatio ? { aspectRatio } : undefined}>
      {isLoading && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <Image
        src={src}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        loading="lazy"
        quality={80}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        {...props}
      />
    </div>
  );
}
