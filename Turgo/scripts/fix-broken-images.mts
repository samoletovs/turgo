/**
 * Replace all broken 404 image URLs with verified working ones.
 * Usage: npx tsx scripts/fix-broken-images.mts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// Map of broken photo IDs → verified working replacements
const REPLACEMENTS: Record<string, string> = {
  "photo-1585412459212-8def26f7f0ea": "photo-1502672260266-1c1ef2d93688",
  "photo-1523217553820-bd8e2069e1ee": "photo-1560448204-e02f11c3d0e2",
  "photo-1560185008-b033106af5c8": "photo-1493809842364-78817add7ffb",
  "photo-1544923246-77307dd270b5": "photo-1516826957135-700dedea698c",
  "photo-1505705694340-019e0d0e5dc5": "photo-1485965120184-e220f721d03e",
  "photo-1558442074-3c19f8801e97": "photo-1484154218962-a197022b5858",
  "photo-1583337130417-13104dec14a3": "photo-1587300003388-59208cc962cb",
  "photo-1580910051074-3eb694886f5b": "photo-1511707171634-5f897ff02aa9",
  "photo-1590856029826-c7a73142bbcd": "photo-1530267981375-f0de937f5f13",
  "photo-1558618666-fcd25c85f82e": "photo-1571175443880-49e1d25b2bc5",
  "photo-1558290935-07a8e143fbb0": "photo-1464226184884-fa280b87c399",
  "photo-1592805723127-004b174f6479": "photo-1500595046743-cd271d694d30",
  "photo-1558171813-01eda7bcd3d6": "photo-1539533113208-f6df8cc8b543",
  "photo-1525609004556-c46c2474feb3": "photo-1494976388531-d1058494cdd8",
  "photo-1609779160382-7e1f3fbc8a34": "photo-1543466835-00a7907e9de1",
  "photo-1600861194802-a928e2b8bd5a": "photo-1606144042614-b2417e99c4e3",
  "photo-1595558009579-876cf21b02c2": "photo-1576435728678-68d0fbf94e91",
  "photo-1574269909862-7e3d7bc41d2b": "photo-1626806787461-102c1bfaaea1",
};

async function main() {
  console.log("🔧 Fixing broken image URLs...\n");
  let fixed = 0;

  const allImages = await db.listingImage.findMany();

  for (const img of allImages) {
    let newUrl = img.url;
    let changed = false;

    for (const [broken, replacement] of Object.entries(REPLACEMENTS)) {
      if (img.url.includes(broken)) {
        newUrl = img.url.replace(broken, replacement);
        changed = true;
        break;
      }
    }

    if (changed) {
      await db.listingImage.update({
        where: { id: img.id },
        data: {
          url: newUrl,
          thumbnailUrl: newUrl.replace("w=800", "w=200").replace("q=80", "q=60"),
        },
      });
      fixed++;
    }
  }

  console.log(`✅ Fixed ${fixed} broken image URLs`);

  // Verify all are now working
  console.log("\n🔍 Verifying all images...");
  const images = await db.listingImage.findMany({ select: { url: true } });
  const uniqueUrls = [...new Set(images.map(i => i.url))];
  let stillBroken = 0;

  for (const url of uniqueUrls) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        console.log(`  ❌ Still broken: ${url} (${res.status})`);
        stillBroken++;
      }
    } catch (e: unknown) {
      console.log(`  ❌ Error: ${url} (${e instanceof Error ? e.message : String(e)})`);
      stillBroken++;
    }
  }

  if (stillBroken === 0) {
    console.log(`✅ All ${uniqueUrls.length} unique image URLs are valid!`);
  } else {
    console.log(`\n⚠️  ${stillBroken} URLs still broken`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); process.exit(0); });
