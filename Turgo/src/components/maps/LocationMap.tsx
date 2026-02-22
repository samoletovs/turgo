"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComponentType } from "react";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
  markerLabel?: string;
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
}: LocationMapProps) {
  const t = useTranslations("common");

  return (
    <div className={className} style={{ minHeight: 300 }}>
      <MapInner
        latitude={latitude}
        longitude={longitude}
        zoom={zoom}
        markerLabel={markerLabel ?? t("location")}
      />
    </div>
  );
}
