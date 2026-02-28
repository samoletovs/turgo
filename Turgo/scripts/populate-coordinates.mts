/**
 * Populate listings with random latitude/longitude from real places in Latvia.
 * Usage: npx tsx scripts/populate-coordinates.mts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Real places in Latvia with slight randomisation radius
const LATVIAN_PLACES = [
  { name: "Riga Centre",        lat: 56.9496, lng: 24.1052 },
  { name: "Riga - Āgenskalns",  lat: 56.9390, lng: 24.0780 },
  { name: "Riga - Teika",       lat: 56.9620, lng: 24.1700 },
  { name: "Riga - Imanta",      lat: 56.9530, lng: 24.0200 },
  { name: "Riga - Purvciems",   lat: 56.9650, lng: 24.1550 },
  { name: "Jūrmala - Majori",   lat: 56.9680, lng: 23.7930 },
  { name: "Jūrmala - Dzintari", lat: 56.9720, lng: 23.8100 },
  { name: "Jūrmala - Bulduri",  lat: 56.9730, lng: 23.8480 },
  { name: "Liepāja",            lat: 56.5047, lng: 21.0107 },
  { name: "Daugavpils",         lat: 55.8749, lng: 26.5364 },
  { name: "Ventspils",          lat: 57.3942, lng: 21.5608 },
  { name: "Jelgava",            lat: 56.6511, lng: 23.7214 },
  { name: "Sigulda",            lat: 57.1531, lng: 24.8536 },
  { name: "Cēsis",              lat: 57.3119, lng: 25.2748 },
  { name: "Valmiera",           lat: 57.5384, lng: 25.4263 },
  { name: "Ogre",               lat: 56.8167, lng: 24.6045 },
  { name: "Tukums",             lat: 56.9668, lng: 23.1532 },
  { name: "Kuldīga",            lat: 56.9677, lng: 21.9690 },
  { name: "Salaspils",          lat: 56.8614, lng: 24.3494 },
  { name: "Rēzekne",            lat: 56.5099, lng: 27.3340 },
];

/** Add small random offset (±~500 m) so pins don't stack exactly */
function jitter(value: number): number {
  return value + (Math.random() - 0.5) * 0.01;
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true },
  });

  console.log(`Found ${listings.length} listings. Assigning coordinates…\n`);

  for (let i = 0; i < listings.length; i++) {
    const place = LATVIAN_PLACES[i % LATVIAN_PLACES.length];
    const lat = jitter(place.lat);
    const lng = jitter(place.lng);

    await prisma.listing.update({
      where: { id: listings[i].id },
      data: { latitude: lat, longitude: lng },
    });

    console.log(
      `  ✓ "${listings[i].title}" → ${place.name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    );
  }

  console.log(`\n✅ Done — ${listings.length} listings updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
