"use client";

import { useRef, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/* Fix Leaflet default marker icon issue in bundlers */
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationMapInnerProps {
  latitude: number;
  longitude: number;
  zoom: number;
  markerLabel: string;
}

export default function LocationMapInner({
  latitude,
  longitude,
  zoom,
  markerLabel,
}: LocationMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create map instance
    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker([latitude, longitude], { icon: defaultIcon })
      .addTo(map)
      .bindPopup(markerLabel);

    mapRef.current = map;

    // Proper cleanup — removes Leaflet's internal reference to the DOM node
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, zoom, markerLabel]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-xl"
      style={{ minHeight: 300 }}
    />
  );
}
