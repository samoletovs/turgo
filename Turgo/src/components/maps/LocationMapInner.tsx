"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full rounded-xl"
      style={{ minHeight: 300 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={defaultIcon}>
        <Popup>{markerLabel}</Popup>
      </Marker>
    </MapContainer>
  );
}
