"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
  markerLabel?: string;
  address?: string;
}

interface MapInnerProps {
  latitude: number;
  longitude: number;
  zoom: number;
  markerLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Inner map (only imported client-side, no SSR)                      */
/* ------------------------------------------------------------------ */

function MapLoading() {
  return <Skeleton className="h-full w-full rounded-xl" />;
}

const MapInner = dynamic<MapInnerProps>(
  () =>
    import("@/components/maps/LocationMapInner") as Promise<{
      default: ComponentType<MapInnerProps>;
    }>,
  {
    ssr: false,
    loading: MapLoading,
  },
);

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

export function LocationMap({
  latitude,
  longitude,
  zoom = 13,
  className,
  markerLabel,
  address,
}: LocationMapProps) {
  const t = useTranslations("common");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const label = markerLabel ?? t("location");

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        {/* Inline placeholder to keep layout stable */}
        <div className={className} style={{ minHeight: 300 }}>
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border bg-muted text-muted-foreground">
            <Button variant="outline" onClick={toggleFullscreen}>
              <Minimize2 className="mr-2 h-4 w-4" />
              {t("close")}
            </Button>
          </div>
        </div>

        {/* Fullscreen overlay */}
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
          <div className="absolute right-4 top-4 z-[60] flex gap-2">
            {address && (
              <div className="rounded-lg bg-background/90 px-3 py-2 text-sm font-medium shadow-lg border">
                {address}
              </div>
            )}
            <Button
              variant="destructive"
              onClick={toggleFullscreen}
              className="h-10 gap-2 px-4 shadow-lg"
            >
              <X className="h-5 w-5" />
              {t("close")}
            </Button>
          </div>
          <div className="h-full w-full pb-12">
            <MapInner
              latitude={latitude}
              longitude={longitude}
              zoom={zoom + 1}
              markerLabel={address || label}
            />
          </div>
          {/* Bottom close bar */}
          <button
            onClick={toggleFullscreen}
            className="fixed bottom-0 left-0 z-[60] flex w-full cursor-pointer items-center justify-center gap-2 border-t bg-destructive py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Minimize2 className="h-4 w-4" />
            {t("close")}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <div className="overflow-hidden rounded-xl" style={{ minHeight: 300 }}>
        <MapInner
          latitude={latitude}
          longitude={longitude}
          zoom={zoom}
          markerLabel={address || label}
        />
      </div>
      {/* Expand bar — always visible below the map */}
      <button
        onClick={toggleFullscreen}
        className="flex w-full items-center justify-center gap-2 rounded-b-xl border border-t-0 bg-muted/80 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <Maximize2 className="h-4 w-4" />
        {t("expandMap")}
      </button>
    </div>
  );
}
