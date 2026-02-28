/**
 * Geocoding utility — converts address strings to coordinates using
 * OpenStreetMap's Nominatim API (free, no API key required).
 *
 * Usage:
 *   import { geocodeAddress } from "@/lib/geocode";
 *   const result = await geocodeAddress("Riga, Latvia");
 *   // => { latitude: 56.946, longitude: 24.105, displayName: "Riga, Latvia" }
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Geocode an address string to lat/lng coordinates.
 * Returns null if no results found or the service is unavailable.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      addressdetails: "0",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "Turgo-Classifieds/1.0 (https://turgo.com)",
        Accept: "application/json",
      },
      // Don't cache aggressively — addresses rarely change
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!data.length) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (error) {
    console.error("[geocode] Failed to geocode address:", error);
    return null;
  }
}
