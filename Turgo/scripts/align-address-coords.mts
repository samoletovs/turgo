/**
 * Re-align coordinates, addresses AND locationId so everything is consistent.
 * Each listing gets a place, the matching lat/lng, a street address in that city,
 * AND the correct Location record from the DB.
 * Usage: npx tsx scripts/align-address-coords.mts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Unified place data: coordinates + streets + locationId from the DB
// locationIds gathered from the Location table
const PLACES = [
  { lat: 56.9496, lng: 24.1052, city: "Rīga",        locationId: "cmlwxwnmt002kh0ttz2a2bf3b", streets: ["Brīvības iela 54", "Elizabetes iela 22", "Tērbatas iela 15", "Krišjāņa Barona iela 30"] },
  { lat: 56.9390, lng: 24.0780, city: "Rīga",        locationId: "cmlwxwnmt002kh0ttz2a2bf3b", streets: ["Eduarda Smiļģa iela 8", "Mārupes iela 12", "Nometņu iela 44"] },
  { lat: 56.9620, lng: 24.1700, city: "Rīga",        locationId: "cmlwxwnmt002kh0ttz2a2bf3b", streets: ["Brīvības gatve 214", "Gustava Zemgala gatve 74", "Ilūkstes iela 10"] },
  { lat: 56.9530, lng: 24.0200, city: "Rīga",        locationId: "cmlwxwnmt002kh0ttz2a2bf3b", streets: ["Anniņmuižas bulvāris 40", "Kurzemes prospekts 120", "Imantas iela 7"] },
  { lat: 56.9650, lng: 24.1550, city: "Rīga",        locationId: "cmlwxwnmt002kh0ttz2a2bf3b", streets: ["Dzelzavas iela 72", "Stirnu iela 34", "Purvciema iela 20"] },
  { lat: 56.9680, lng: 23.7930, city: "Jūrmala",     locationId: "cmlwxwnpb002mh0ttwydj4odl", streets: ["Jomas iela 42", "Tirgoņu iela 8", "Pilsoņu iela 15"] },
  { lat: 56.9720, lng: 23.8100, city: "Jūrmala",     locationId: "cmlwxwnpb002mh0ttwydj4odl", streets: ["Dzintaru prospekts 28", "Edinburgas prospekts 5", "Meža prospekts 18"] },
  { lat: 56.9730, lng: 23.8480, city: "Jūrmala",     locationId: "cmlwxwnpb002mh0ttwydj4odl", streets: ["Vienības prospekts 32", "Bulduru prospekts 11"] },
  { lat: 56.5047, lng: 21.0107, city: "Liepāja",     locationId: "cmlwxwnxc002th0ttnafun3mv", streets: ["Liela iela 10", "Kūrmājas prospekts 18", "Graudu iela 44"] },
  { lat: 55.8749, lng: 26.5364, city: "Daugavpils",   locationId: "cmlwxwo8m0033h0ttarrc75uk", streets: ["Rīgas iela 22", "Saules iela 11", "Viestura iela 8"] },
  { lat: 57.3942, lng: 21.5608, city: "Ventspils",    locationId: "cmlwxwnyf002uh0ttbq805t59", streets: ["Kuldīgas iela 15", "Pils iela 5", "Lielais prospekts 40"] },
  { lat: 56.6511, lng: 23.7214, city: "Jelgava",      locationId: "cmlwxwoeb0038h0ttla9d5toh", streets: ["Liela iela 6", "Pasta iela 20", "Akadēmijas iela 10"] },
  { lat: 57.1531, lng: 24.8536, city: "Sigulda",      locationId: "cmlwxwntz002qh0ttzxmiwgyf", streets: ["Pils iela 16", "Raiņa iela 3", "Gaujas iela 12"] },
  { lat: 57.3119, lng: 25.2748, city: "Cēsis",        locationId: "cmlwxwo44002zh0tt6gb4lk4z", streets: ["Rīgas iela 18", "Vienības laukums 2", "Pils iela 9"] },
  { lat: 57.5384, lng: 25.4263, city: "Valmiera",     locationId: "cmlwxwo2z002yh0tt83y19696", streets: ["Rīgas iela 10", "Cēsu iela 4", "Stacijas iela 2"] },
  { lat: 56.8167, lng: 24.6045, city: "Ogre",         locationId: "cmlwxwnv2002rh0tt9gjhr8ax", streets: ["Brīvības iela 33", "Mālkalnes prospekts 18", "Skolas iela 5"] },
  { lat: 56.9668, lng: 23.1532, city: "Tukums",       locationId: "cmlwxwogk003ah0ttvje663xc", streets: ["Talsu iela 4", "Pils iela 8", "Raudas iela 12"] },
  { lat: 56.9677, lng: 21.9690, city: "Kuldīga",      locationId: "cmlwxwnzj002vh0tttnkpxt89", streets: ["Liepājas iela 14", "Pilsētas laukums 3", "Baznīcas iela 7"] },
  { lat: 56.8614, lng: 24.3494, city: "Salaspils",    locationId: "cmlwxwnsv002ph0ttngcgqlkh", streets: ["Skolas iela 2", "Enerģētiķu iela 9", "Lauku iela 5"] },
  { lat: 56.5099, lng: 27.3340, city: "Rēzekne",      locationId: "cmlwxwo9q0034h0ttoeo5fge8", streets: ["Atbrīvošanas aleja 93", "Latgales iela 20", "Viļānu iela 8"] },
];

/** Add small random offset (±~500 m) so pins don't stack exactly */
function jitter(value: number): number {
  return value + (Math.random() - 0.5) * 0.01;
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true },
    orderBy: { id: "asc" }, // deterministic order
  });

  console.log(`Found ${listings.length} listings. Aligning address + coordinates + location…\n`);

  for (let i = 0; i < listings.length; i++) {
    const place = PLACES[i % PLACES.length];
    const street = place.streets[i % place.streets.length];
    const address = `${street}, ${place.city}, Latvia`;
    const lat = jitter(place.lat);
    const lng = jitter(place.lng);

    await prisma.listing.update({
      where: { id: listings[i].id },
      data: {
        address,
        latitude: lat,
        longitude: lng,
        locationId: place.locationId,
      },
    });

    console.log(
      `  ✓ "${listings[i].title}" → ${place.city}: ${address}  (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    );
  }

  console.log(`\n✅ Done — ${listings.length} listings updated with aligned address + coordinates + location.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
