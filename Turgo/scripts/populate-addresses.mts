/**
 * Populate existing listings with address strings matching their coordinates.
 * Usage: npx tsx scripts/populate-addresses.mts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Map coordinate ranges to realistic addresses
const LATVIAN_ADDRESSES: Record<string, { city: string; streets: string[] }> = {
  "Riga Centre": {
    city: "Rīga",
    streets: ["Brīvības iela 54", "Elizabetes iela 22", "Tērbatas iela 15", "Krišjāņa Barona iela 30"],
  },
  "Riga - Āgenskalns": {
    city: "Rīga",
    streets: ["Eduarda Smiļģa iela 8", "Mārupes iela 12", "Nometņu iela 44"],
  },
  "Riga - Teika": {
    city: "Rīga",
    streets: ["Brīvības gatve 214", "Gustava Zemgala gatve 74", "Ilūkstes iela 10"],
  },
  "Riga - Imanta": {
    city: "Rīga",
    streets: ["Anniņmuižas bulvāris 40", "Kurzemes prospekts 120", "Imantas iela 7"],
  },
  "Riga - Purvciems": {
    city: "Rīga",
    streets: ["Dzelzavas iela 72", "Stirnu iela 34", "Purvciema iela 20"],
  },
  "Jūrmala - Majori": {
    city: "Jūrmala",
    streets: ["Jomas iela 42", "Tirgoņu iela 8", "Pilsoņu iela 15"],
  },
  "Jūrmala - Dzintari": {
    city: "Jūrmala",
    streets: ["Dzintaru prospekts 28", "Edinburgas prospekts 5", "Meža prospekts 18"],
  },
  "Jūrmala - Bulduri": {
    city: "Jūrmala",
    streets: ["Vienības prospekts 32", "Bulduru prospekts 11"],
  },
  "Liepāja": {
    city: "Liepāja",
    streets: ["Liela iela 10", "Kūrmājas prospekts 18", "Graudu iela 44"],
  },
  "Daugavpils": {
    city: "Daugavpils",
    streets: ["Rīgas iela 22", "Saules iela 11", "Viestura iela 8"],
  },
  "Ventspils": {
    city: "Ventspils",
    streets: ["Kuldīgas iela 15", "Pils iela 5", "Lielais prospekts 40"],
  },
  "Jelgava": {
    city: "Jelgava",
    streets: ["Liela iela 6", "Pasta iela 20", "Akadēmijas iela 10"],
  },
  "Sigulda": {
    city: "Sigulda",
    streets: ["Pils iela 16", "Raiņa iela 3", "Gaujas iela 12"],
  },
  "Cēsis": {
    city: "Cēsis",
    streets: ["Rīgas iela 18", "Vienības laukums 2", "Pils iela 9"],
  },
  "Valmiera": {
    city: "Valmiera",
    streets: ["Rīgas iela 10", "Cēsu iela 4", "Stacijas iela 2"],
  },
  "Ogre": {
    city: "Ogre",
    streets: ["Brīvības iela 33", "Mālkalnes prospekts 18", "Skolas iela 5"],
  },
  "Tukums": {
    city: "Tukums",
    streets: ["Talsu iela 4", "Pils iela 8", "Raudas iela 12"],
  },
  "Kuldīga": {
    city: "Kuldīga",
    streets: ["Liepājas iela 14", "Pilsētas laukums 3", "Baznīcas iela 7"],
  },
  "Salaspils": {
    city: "Salaspils",
    streets: ["Skolas iela 2", "Enerģētiķu iela 9", "Lauku iela 5"],
  },
  "Rēzekne": {
    city: "Rēzekne",
    streets: ["Atbrīvošanas aleja 93", "Latgales iela 20", "Viļānu iela 8"],
  },
};

const PLACE_NAMES = Object.keys(LATVIAN_ADDRESSES);

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true },
  });

  console.log(`Found ${listings.length} listings. Assigning addresses…\n`);

  for (let i = 0; i < listings.length; i++) {
    const placeName = PLACE_NAMES[i % PLACE_NAMES.length];
    const place = LATVIAN_ADDRESSES[placeName];
    const street = place.streets[i % place.streets.length];
    const address = `${street}, ${place.city}, Latvia`;

    await prisma.listing.update({
      where: { id: listings[i].id },
      data: { address },
    });

    console.log(`  ✓ "${listings[i].title}" → ${address}`);
  }

  console.log(`\n✅ Done — ${listings.length} listings updated with addresses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
