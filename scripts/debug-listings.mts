import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// 1. Check categories
const cats = await db.category.findMany({
  where: { slug: { in: ["transport", "cars"] } },
  include: {
    _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    children: {
      include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
    },
  },
});
console.log("\n=== Categories ===");
for (const c of cats) {
  console.log(`  ${c.slug} (id: ${c.id}) - ACTIVE listings: ${c._count.listings}`);
  for (const ch of c.children) {
    console.log(`    ${ch.slug} (id: ${ch.id}) - ACTIVE listings: ${ch._count.listings}`);
  }
}

// 2. Check listings and their categoryIds
const listings = await db.listing.findMany({
  select: { id: true, title: true, status: true, categoryId: true, category: { select: { slug: true } } },
  take: 30,
});
console.log("\n=== All Listings ===");
for (const l of listings) {
  console.log(`  ${l.title} | status: ${l.status} | categoryId: ${l.categoryId} | categorySlug: ${l.category?.slug}`);
}

await db.$disconnect();
await pool.end();
