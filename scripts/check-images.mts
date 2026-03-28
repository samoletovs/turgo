import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// Get all image URLs and test them
const listings = await db.listing.findMany({
  include: { images: { select: { id: true, url: true } } },
  orderBy: { title: "asc" },
});

const broken: { title: string; url: string; status: number | string }[] = [];

for (const listing of listings) {
  for (const img of listing.images) {
    try {
      const res = await fetch(img.url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        broken.push({ title: listing.title, url: img.url, status: res.status });
      }
    } catch (e: unknown) {
      broken.push({ title: listing.title, url: img.url, status: (e instanceof Error ? e.message : "error") });
    }
  }
}

if (broken.length === 0) {
  console.log("✅ All image URLs are valid!");
} else {
  console.log(`❌ Found ${broken.length} broken images:\n`);
  for (const b of broken) {
    console.log(`  ${b.title}`);
    console.log(`    URL: ${b.url}`);
    console.log(`    Status: ${b.status}\n`);
  }
}

await db.$disconnect();
await pool.end();
process.exit(0);
