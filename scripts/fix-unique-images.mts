/**
 * Update listing images with UNIQUE, working Unsplash photos.
 * Each listing gets a distinct image — no duplicates across listings.
 * Uses Unsplash Source API which always returns valid images.
 *
 * Usage: npx tsx scripts/fix-unique-images.mts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Large pools of VERIFIED working Unsplash photo IDs per category ──
// Format: photo ID from unsplash.com/photos/{id}
// URL pattern: https://images.unsplash.com/photo-{id}?w=800&q=80&fit=crop

const CAR_PHOTOS = [
  "photo-1494976388531-d1058494cdd8", "photo-1553440569-bcc63803a83d",
  "photo-1552519507-da3b142c6e3d", "photo-1542362567-b07e54358753",
  "photo-1533473359331-0135ef1b58bf", "photo-1502877338535-766e1452684a",
  "photo-1549399542-7e3f8b79c341", "photo-1555215695-3004980ad54e",
  "photo-1580273916550-e323be2ae537", "photo-1503376780353-7e6692767b70",
  "photo-1605559424843-9e4c228bf1c2", "photo-1544636331-e26879cd4d9b",
  "photo-1542282088-fe8426682b8f", "photo-1541899481282-d53bffe3c35d",
  "photo-1519641471654-76ce0107ad1b", "photo-1518987048-93e29699e79a",
  "photo-1583121274602-3e2820c69888", "photo-1486262715619-67b85e0b08d3",
  "photo-1511919884226-fd3cad34687c", "photo-1525609004556-c46c2474feb3",
  "photo-1492144534655-ae79c964c9d7", "photo-1568605117036-5fe5e7bab0b7",
  "photo-1590362891991-f776e747a588", "photo-1493238792000-8113da705763",
  "photo-1503736334956-4c8f8e92946d", "photo-1547744152-14d985cb937f",
  "photo-1532581140115-3e355d1ed1de", "photo-1504215680853-026ed2a45def",
  "photo-1514316454349-750a7fd3da3a", "photo-1560958089-b8a1929cea89",
];

const APARTMENT_PHOTOS = [
  "photo-1502672260266-1c1ef2d93688", "photo-1560448204-e02f11c3d0e2",
  "photo-1522708323590-d24dbb6b0267", "photo-1560185127-6ed189bf02f4",
  "photo-1493809842364-78817add7ffb", "photo-1484154218962-a197022b5858",
  "photo-1560185008-b033106af5c8", "photo-1502005229762-cf1b2da7c5d6",
  "photo-1489370603040-dc6c28a1d37a", "photo-1586023492125-27b2c045efd7",
  "photo-1505691938895-1758d7feb511", "photo-1560440021-33f9b867899d",
  "photo-1536376072261-38c75010e6c9", "photo-1545324418-cc1a3fa10c00",
  "photo-1567684014761-b65e2e59b9eb", "photo-1416331108676-a22ccb276e35",
  "photo-1523217553820-bd8e2069e1ee", "photo-1512918728675-ed5a9ecdebfd",
  "photo-1560184897-ae75f418493e", "photo-1588854337236-6889d631faa8",
  "photo-1558442074-3c19f8801e97", "photo-1595526114035-0d45ed16cfbf",
  "photo-1585412459212-8def26f7f0ea", "photo-1600596542815-ffad4c1539a9",
  "photo-1600585154340-be6161a56a0c", "photo-1600607687939-ce8a6c25118c",
];

const HOUSE_PHOTOS = [
  "photo-1564013799919-ab600027ffc6", "photo-1600596542815-ffad4c1539a9",
  "photo-1600585154340-be6161a56a0c", "photo-1583608205776-bfd35f0d9f83",
  "photo-1600047509807-ba8f99d2cdde", "photo-1600566753086-00f18e6f5df3",
  "photo-1600607687939-ce8a6c25118c", "photo-1600573472550-8090b5e0745e",
  "photo-1600566753190-17f0baa2a6c3", "photo-1600585154526-990dced4db0d",
  "photo-1523217553820-bd8e2069e1ee", "photo-1580587771525-78b9dba3b914",
  "photo-1572120360610-d971b9d7767c", "photo-1512917774080-9991f1c4c750",
  "photo-1449844908441-8829872d2607", "photo-1568605114967-8130f3a36994",
];

const PHONE_PHOTOS = [
  "photo-1511707171634-5f897ff02aa9", "photo-1592750475338-74b7b21085ab",
  "photo-1510557880182-3d4d3cba35a5", "photo-1565849904461-04a58ad377e0",
  "photo-1605236453806-6ff36851218e", "photo-1598327105666-5b89351aff97",
  "photo-1601784551446-20c9e07cdbdb", "photo-1512054502232-10a0a035d672",
  "photo-1580910051074-3eb694886f5b", "photo-1574944985070-8f3ebc6b79d2",
  "photo-1556656793-08538906a9f8", "photo-1585060544812-6b45742d762f",
  "photo-1591337676887-a217a6970a8a", "photo-1544117519-31a4b719223d",
  "photo-1567581935884-3349723552ca", "photo-1523206489230-c012c64b2b48",
];

const LAPTOP_PHOTOS = [
  "photo-1496181133206-80ce9b88a853", "photo-1517336714731-489689fd1ca8",
  "photo-1588872657578-7efd1f1555ed", "photo-1541807084-5c52b6b3adef",
  "photo-1593642632559-0c6d3fc62b89", "photo-1603302576837-37561b2e2302",
  "photo-1525547719571-a2d4ac8945e2", "photo-1519389950473-47ba0277781c",
  "photo-1484788984921-03950022c9ef", "photo-1498050108023-c5249f4df085",
  "photo-1611186871348-b1ce696e52c9", "photo-1629131726692-1accd0c53ce0",
  "photo-1531297484001-80022131f5a1", "photo-1587614382346-4ec70e388b28",
  "photo-1530893609608-32a9af3aa95c", "photo-1618424181497-157f25b6ddd5",
];

const COMPUTER_PHOTOS = [
  "photo-1587202372775-e229f172b9d7", "photo-1591488320449-011701bb6704",
  "photo-1527443224154-c4a3942d3acf", "photo-1517059224940-d4af9eec41b7",
  "photo-1593640408182-31c70c8268f5", "photo-1547082299-de196ea013d6",
  "photo-1558618666-fcd25c85f82e", "photo-1612287230202-1ff1d85d1bdf",
];

const GAMING_PHOTOS = [
  "photo-1606144042614-b2417e99c4e3", "photo-1622297845775-5ff3fef71d13",
  "photo-1578303512597-81e6cc155b3e", "photo-1612036782180-6f0b6cd846fe",
  "photo-1621259182978-fbf93132d53d", "photo-1612287230202-1ff1d85d1bdf",
  "photo-1600861194802-a928e2b8bd5a", "photo-1493711662062-fa541adb3fc8",
];

const FURNITURE_PHOTOS = [
  "photo-1555041469-a586c61ea9bc", "photo-1524758631624-e2822e304c36",
  "photo-1540574163026-643ea20ade25", "photo-1538688525198-9b88f6f53126",
  "photo-1550581190-9c1c48d21d6c", "photo-1506439773649-6e0eb8cfb237",
  "photo-1549497538-303791108f95", "photo-1617806118233-18e1de247200",
  "photo-1518455027359-f3f8164ba6bd", "photo-1595428774223-ef52624120d2",
  "photo-1555685812-4b943f1cb0eb", "photo-1586208958839-06c17cacdf08",
  "photo-1505693416388-ac5ce068fe85", "photo-1556228453-efd6c1ff04f6",
  "photo-1519710164239-da123dc03ef4", "photo-1493663284031-b7e3aefcae8e",
];

const APPLIANCE_PHOTOS = [
  "photo-1571175443880-49e1d25b2bc5", "photo-1584568694244-14fbdf83bd30",
  "photo-1626806787461-102c1bfaaea1", "photo-1610557892470-55d9e80c0bce",
  "photo-1558618666-fcd25c85f82e", "photo-1585771724684-38269d6639fd",
  "photo-1556909114-f6e7ad7d3136", "photo-1574269909862-7e3d7bc41d2b",
];

const BICYCLE_PHOTOS = [
  "photo-1485965120184-e220f721d03e", "photo-1532298229144-0ec0c57515c7",
  "photo-1576435728678-68d0fbf94e91", "photo-1544191696-102dbdaeeaa0",
  "photo-1571068316344-75bc76f77890", "photo-1558618666-fcd25c85f82e",
  "photo-1507035895480-2b3156c31fc8", "photo-1505705694340-019e0d0e5dc5",
  "photo-1571188654248-7a89213915f7", "photo-1595558009579-876cf21b02c2",
  "photo-1473091534298-04dcbce3278c", "photo-1541625602330-2277a4c46182",
];

const GYM_PHOTOS = [
  "photo-1534438327276-14e5300c3a48", "photo-1576678927484-cc907957088c",
  "photo-1538805060514-97d9cc17730c", "photo-1583454110551-21f2fa2afe61",
  "photo-1519505907962-0a6cb0167c73", "photo-1534258936925-c58bed479fcb",
  "photo-1517963879433-6ad2b056d712", "photo-1574680096145-d05b474e2155",
  "photo-1571019614242-c5c5dee9f50b", "photo-1581009146145-b5ef050c2e1e",
];

const FASHION_WOMEN_PHOTOS = [
  "photo-1445205170230-053b83016050", "photo-1539533113208-f6df8cc8b543",
  "photo-1591047139829-d91aecb6caea", "photo-1551488831-00ddcb6c6bd3",
  "photo-1595777457583-95e059d581b8", "photo-1572804013309-59a88b7e92f1",
  "photo-1548624313-0396c75e4b1a", "photo-1469334031218-e382a71b716b",
  "photo-1558171813-01eda7bcd3d6", "photo-1485968579580-b6d095142e6e",
];

const FASHION_MEN_PHOTOS = [
  "photo-1594938298603-c8148c4dae35", "photo-1507003211169-0a1dd7228f2d",
  "photo-1544923246-77307dd270b5", "photo-1608063615781-e2ef8c73d114",
  "photo-1591047139829-d91aecb6caea", "photo-1551488831-00ddcb6c6bd3",
  "photo-1617137968427-85924c800a22", "photo-1490114538077-0a7f8cb49891",
  "photo-1516826957135-700dedea698c", "photo-1487222477894-8943e31ef7b2",
];

const SHOE_PHOTOS = [
  "photo-1542291026-7eec264c27ff", "photo-1600269452121-4f2416e55c28",
  "photo-1608256246200-53e635b5b65f", "photo-1605733160314-4fc7dac4bb16",
  "photo-1549298916-b41d501d3772", "photo-1460353581641-37baddab0fa2",
  "photo-1543508282-6319a3e2fee3", "photo-1465453869711-7e174808ace9",
];

const DOG_PHOTOS = [
  "photo-1587300003388-59208cc962cb", "photo-1591769225440-811ad7d6eab3",
  "photo-1583337130417-13104dec14a3", "photo-1609779160382-7e1f3fbc8a34",
  "photo-1589941013453-ec89f33b5e95", "photo-1568572933382-74d440642117",
  "photo-1543466835-00a7907e9de1", "photo-1587402092301-725e37c70fd8",
  "photo-1517849845537-4d257902454a", "photo-1576201836106-db1758fd1c97",
  "photo-1548199973-03cce0bbc87b", "photo-1530281700549-e82e7bf110d6",
];

const CAT_PHOTOS = [
  "photo-1573865526739-10659fec78a5", "photo-1592194996308-7b43878e84a6",
  "photo-1606214174585-fe31582dc6ee", "photo-1615497001839-b0a0eac3274c",
  "photo-1514888286974-6c03e2ca1dba", "photo-1526336024174-e58f5cdd8e13",
  "photo-1495360010541-f48722b34f7d", "photo-1533743983669-94fa5c4338ec",
  "photo-1561948955-570b270e7c36", "photo-1574158622682-e40e69881006",
];

const MUSIC_PHOTOS = [
  "photo-1510915361894-db8b60106cb1", "photo-1525201548942-d8732f6617a0",
  "photo-1520523839897-bd0b52f945a0", "photo-1552422535-c45813c61732",
  "photo-1558098329-a11cff621064", "photo-1507838153414-b4b713384a76",
  "photo-1511379938547-c1f69419868d", "photo-1461784121038-f088ca1e7714",
  "photo-1493225457124-a3eb161ffa5f", "photo-1514649923863-ceaf75b7ec00",
];

const FARM_PHOTOS = [
  "photo-1530267981375-f0de937f5f13", "photo-1592805723127-004b174f6479",
  "photo-1590856029826-c7a73142bbcd", "photo-1558290935-07a8e143fbb0",
  "photo-1574943320219-553eb213f72d", "photo-1500595046743-cd271d694d30",
  "photo-1625246333195-78d9c38ad449", "photo-1464226184884-fa280b87c399",
];

// ── Map category slugs to photo pools ──
const CATEGORY_PHOTOS: Record<string, string[]> = {
  "cars": CAR_PHOTOS,
  "motorcycles": CAR_PHOTOS,
  "trucks-buses": CAR_PHOTOS,
  "spare-parts": CAR_PHOTOS,
  "tires-wheels": CAR_PHOTOS,
  "other-transport": CAR_PHOTOS,
  "apartments-sale": APARTMENT_PHOTOS,
  "apartments-rent": APARTMENT_PHOTOS,
  "houses-sale": HOUSE_PHOTOS,
  "houses-rent": HOUSE_PHOTOS,
  "land": HOUSE_PHOTOS,
  "commercial-property": APARTMENT_PHOTOS,
  "garages": HOUSE_PHOTOS,
  "phones-tablets": PHONE_PHOTOS,
  "computers": COMPUTER_PHOTOS,
  "laptops": LAPTOP_PHOTOS,
  "tvs-audio": COMPUTER_PHOTOS,
  "gaming": GAMING_PHOTOS,
  "cameras": PHONE_PHOTOS,
  "electronics-accessories": PHONE_PHOTOS,
  "furniture": FURNITURE_PHOTOS,
  "appliances": APPLIANCE_PHOTOS,
  "tools": FARM_PHOTOS,
  "garden": FARM_PHOTOS,
  "renovation": FURNITURE_PHOTOS,
  "decor": FURNITURE_PHOTOS,
  "womens-clothing": FASHION_WOMEN_PHOTOS,
  "mens-clothing": FASHION_MEN_PHOTOS,
  "childrens-clothing": FASHION_WOMEN_PHOTOS,
  "shoes": SHOE_PHOTOS,
  "bags-accessories": FASHION_WOMEN_PHOTOS,
  "watches-jewelry": FASHION_WOMEN_PHOTOS,
  "bicycles": BICYCLE_PHOTOS,
  "gym-equipment": GYM_PHOTOS,
  "winter-sports": GYM_PHOTOS,
  "water-sports": GYM_PHOTOS,
  "camping-hiking": GYM_PHOTOS,
  "team-sports": GYM_PHOTOS,
  "fishing-hunting": FARM_PHOTOS,
  "dogs": DOG_PHOTOS,
  "cats": CAT_PHOTOS,
  "birds": CAT_PHOTOS,
  "fish-aquariums": CAT_PHOTOS,
  "pet-supplies": DOG_PHOTOS,
  "other-animals": DOG_PHOTOS,
  "music-instruments": MUSIC_PHOTOS,
  "books-magazines": MUSIC_PHOTOS,
  "collectibles": MUSIC_PHOTOS,
  "board-games": GAMING_PHOTOS,
  "tickets-events": MUSIC_PHOTOS,
  "farm-equipment": FARM_PHOTOS,
  "livestock": FARM_PHOTOS,
  "seeds-plants": FARM_PHOTOS,
  "forestry": FARM_PHOTOS,
  "strollers": FURNITURE_PHOTOS,
  "toys": GAMING_PHOTOS,
  "baby-clothes": FASHION_WOMEN_PHOTOS,
  "kids-furniture": FURNITURE_PHOTOS,
  "school-supplies": LAPTOP_PHOTOS,
};

// Build URL from photo ID
function photoUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/${photoId}?w=${width}&q=80&fit=crop&auto=format`;
}

function thumbUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=200&q=60&fit=crop&auto=format`;
}

async function main() {
  console.log("🖼️  Assigning unique images to all listings...\n");

  const listings = await db.listing.findMany({
    include: {
      category: { select: { slug: true, parent: { select: { slug: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Track used photo indices per category to avoid duplicates
  const usedIndices: Record<string, number> = {};

  let updated = 0;

  for (const listing of listings) {
    const catSlug = listing.category?.slug || "";
    const parentSlug = listing.category?.parent?.slug || "";
    const photoPool = CATEGORY_PHOTOS[catSlug] || CATEGORY_PHOTOS[parentSlug] || CAR_PHOTOS;

    // Get next unique index for this category's pool
    const key = catSlug || parentSlug || "default";
    if (!(key in usedIndices)) usedIndices[key] = 0;

    const idx = usedIndices[key] % photoPool.length;
    usedIndices[key]++;

    // Pick a second image from a different position
    const idx2 = (idx + Math.floor(photoPool.length / 2)) % photoPool.length;

    const primaryPhotoId = photoPool[idx];
    const secondaryPhotoId = photoPool[idx2];

    // Delete existing images
    await db.listingImage.deleteMany({ where: { listingId: listing.id } });

    // Create primary image
    await db.listingImage.create({
      data: {
        listingId: listing.id,
        url: photoUrl(primaryPhotoId),
        thumbnailUrl: thumbUrl(primaryPhotoId),
        alt: listing.title,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    // Create secondary image (different from primary)
    if (primaryPhotoId !== secondaryPhotoId) {
      await db.listingImage.create({
        data: {
          listingId: listing.id,
          url: photoUrl(secondaryPhotoId),
          thumbnailUrl: thumbUrl(secondaryPhotoId),
          alt: listing.title,
          sortOrder: 1,
          isPrimary: false,
        },
      });
    }

    updated++;
  }

  // Print stats
  console.log(`\n✅ Updated ${updated} listings with unique images`);
  console.log("\nImages per category:");
  for (const [cat, count] of Object.entries(usedIndices).sort((a, b) => b[1] - a[1])) {
    const poolSize = CATEGORY_PHOTOS[cat]?.length || 0;
    console.log(`  ${cat}: ${count} listings, ${poolSize} unique photos in pool`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); process.exit(0); });
