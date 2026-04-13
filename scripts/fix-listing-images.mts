/**
 * Update listing images to match listing content.
 * Maps listing titles/categories to relevant Unsplash photos.
 *
 * Usage: npx tsx scripts/fix-listing-images.mts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Specific image URLs mapped to keywords in titles ──
// Each entry: [keyword regex, [image URLs]]
const TITLE_IMAGE_MAP: [RegExp, string[]][] = [
  // Cars — by brand
  [/toyota/i, [
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
    "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800",
    "https://images.unsplash.com/photo-1626668011687-8a114cf5a34c?w=800",
  ]],
  [/honda\s*civic/i, [
    "https://images.unsplash.com/photo-1551830820-330a71b99659?w=800",
    "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800",
  ]],
  [/volvo/i, [
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800",
    "https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=800",
  ]],
  [/škoda|skoda|octavia/i, [
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800",
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800",
  ]],
  [/ford\s*focus/i, [
    "https://images.unsplash.com/photo-1551830820-330a71b99659?w=800",
    "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800",
  ]],
  [/mazda/i, [
    "https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
  ]],
  [/hyundai\s*tucson/i, [
    "https://images.unsplash.com/photo-1629897048514-3dd7414fe72a?w=800",
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800",
  ]],
  [/kia\s*sportage/i, [
    "https://images.unsplash.com/photo-1629897048514-3dd7414fe72a?w=800",
    "https://images.unsplash.com/photo-1610647752706-3bb12232b3ab?w=800",
  ]],
  [/renault\s*clio/i, [
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800",
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
  ]],
  [/nissan\s*qashqai/i, [
    "https://images.unsplash.com/photo-1610647752706-3bb12232b3ab?w=800",
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800",
  ]],
  [/peugeot/i, [
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
  ]],
  [/dacia\s*duster/i, [
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800",
  ]],
  [/bmw/i, [
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800",
  ]],
  [/volkswagen|golf/i, [
    "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800",
    "https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800",
  ]],
  [/audi/i, [
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800",
    "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800",
  ]],
  [/mercedes/i, [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800",
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800",
  ]],
  [/opel/i, [
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
  ]],
  [/porche|porsche/i, [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
    "https://images.unsplash.com/photo-1611859266238-4b98091d9d9b?w=800",
  ]],

  // Apartments — sale vs rent
  [/dzīvoklis.*pārdod|istabu dzīvoklis|studija|jaunajā projektā|renovētā ēkā/i, [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
  ]],
  [/izīrē|hand_over/i, [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
  ]],

  // Houses
  [/privātmāja|jaunbūve|māja/i, [
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
    "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
  ]],

  // Phones
  [/iphone\s*16/i, [
    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800",
  ]],
  [/iphone\s*15/i, [
    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
    "https://images.unsplash.com/photo-1696446702183-cbd13d78e1e7?w=800",
  ]],
  [/iphone\s*14/i, [
    "https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=800",
    "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800",
  ]],
  [/samsung\s*galaxy/i, [
    "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800",
  ]],
  [/google\s*pixel/i, [
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800",
    "https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800",
  ]],
  [/ipad/i, [
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800",
    "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=800",
  ]],
  [/xiaomi/i, [
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800",
  ]],

  // Laptops
  [/macbook/i, [
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
    "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800",
  ]],
  [/dell\s*xps/i, [
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
  ]],
  [/asus\s*rog|gaming.*laptop|spēļu.*portat/i, [
    "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800",
    "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800",
  ]],
  [/thinkpad|elitebook|aspire|laptop/i, [
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800",
  ]],
  [/lenovo/i, [
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
  ]],

  // Computers / Desktop
  [/gaming\s*pc|rtx|ryzen/i, [
    "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800",
    "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800",
  ]],
  [/imac/i, [
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800",
    "https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?w=800",
  ]],

  // Gaming consoles
  [/playstation|ps5/i, [
    "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800",
    "https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800",
  ]],
  [/nintendo\s*switch/i, [
    "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800",
    "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=800",
  ]],
  [/xbox/i, [
    "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800",
    "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800",
  ]],

  // Furniture
  [/dīvāns|sofa/i, [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800",
  ]],
  [/galds.*krēsl|ēdamistab/i, [
    "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800",
    "https://images.unsplash.com/photo-1549497538-303791108f95?w=800",
  ]],
  [/biroja\s*galds|sit-stand/i, [
    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800",
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
  ]],
  [/kallax|plaukts/i, [
    "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800",
  ]],
  [/gultiņa|bērnu.*gulta/i, [
    "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=800",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
  ]],

  // Appliances
  [/ledusskapis|fridge|refrigerat/i, [
    "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800",
    "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800",
  ]],
  [/veļasmašīna|trauku\s*mazgāj|washing/i, [
    "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800",
    "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=800",
  ]],

  // Bicycles
  [/trek|kalnu\s*velos|mountain\s*bike/i, [
    "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800",
    "https://images.unsplash.com/photo-1544191696-102dbdaeeaa0?w=800",
  ]],
  [/specialized|šosejas|road\s*bike/i, [
    "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800",
    "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800",
  ]],
  [/e-velos|kalkhoff|electric.*bike|cube.*hybrid/i, [
    "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800",
    "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800",
  ]],
  [/frog|bērnu\s*velos/i, [
    "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
  ]],

  // Gym equipment
  [/skrejceliņš|treadmill|nordictrack/i, [
    "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800",
    "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=800",
  ]],
  [/hanteļ|dumbbell/i, [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800",
  ]],
  [/concept2|rowerg|airēšan/i, [
    "https://images.unsplash.com/photo-1519505907962-0a6cb0167c73?w=800",
    "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800",
  ]],
  [/trenažier.*sols|bench\s*press|svaru/i, [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800",
  ]],

  // Fashion — women
  [/zara.*jaka|sieviešu.*jaka/i, [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800",
  ]],
  [/cos.*kleita|kleita/i, [
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800",
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800",
  ]],
  [/max\s*mara|mētelis.*sieviešu|h&m.*mētelis/i, [
    "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800",
    "https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=800",
  ]],

  // Fashion — men
  [/hugo\s*boss|uzvalks/i, [
    "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
  ]],
  [/canada\s*goose|ziemas\s*jaka/i, [
    "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800",
    "https://images.unsplash.com/photo-1608063615781-e2ef8c73d114?w=800",
  ]],
  [/tommy\s*hilfiger|dūnu\s*veste/i, [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800",
  ]],

  // Shoes
  [/nike\s*air\s*max/i, [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
    "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800",
  ]],
  [/dr\.\s*martens/i, [
    "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800",
    "https://images.unsplash.com/photo-1605733160314-4fc7dac4bb16?w=800",
  ]],

  // Pets — dogs
  [/labrador/i, [
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=800",
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800",
  ]],
  [/franču\s*buldog|french\s*bulldog/i, [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800",
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=800",
  ]],
  [/vācu\s*aitu|german\s*shepherd/i, [
    "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=800",
    "https://images.unsplash.com/photo-1568572933382-74d440642117?w=800",
  ]],

  // Pets — cats
  [/britu.*kaķ|british.*cat/i, [
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800",
    "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=800",
  ]],
  [/meinkūn|maine\s*coon/i, [
    "https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=800",
    "https://images.unsplash.com/photo-1615497001839-b0a0eac3274c?w=800",
  ]],

  // Real estate — castles/manors
  [/caste|castle|pils|muiža|manor/i, [
    "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800",
    "https://images.unsplash.com/photo-1546975490-e8b92a360b24?w=800",
  ]],

  // Music instruments
  [/roland.*piano|digitāl.*klav|keyboard/i, [
    "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800",
    "https://images.unsplash.com/photo-1552422535-c45813c61732?w=800",
  ]],
  [/gibson/i, [
    "https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800",
    "https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=800",
  ]],
  [/fender|stratocaster|ģitāra|guitar/i, [
    "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800",
    "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=800",
  ]],
  [/yamaha.*ģitāra|yamaha.*guitar/i, [
    "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800",
    "https://images.unsplash.com/photo-1558098329-a11cff621064?w=800",
  ]],

  // Farm equipment
  [/traktors|john\s*deere|kubota/i, [
    "https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=800",
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
  ]],
  [/automower|robotpļāvējs|husqvarna.*mower/i, [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
    "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800",
  ]],

  // LEGO
  [/lego/i, [
    "https://images.unsplash.com/photo-1518364538800-6bae3c2ea0f2?w=800",
    "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=800",
  ]],

  // Tools
  [/makita|urbis|skrūvgriezis|drill/i, [
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800",
  ]],
];

// ── Fallback images by category slug ──
const CATEGORY_FALLBACK: Record<string, string[]> = {
  cars: ["https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800","https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800"],
  "apartments-sale": ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
  "apartments-rent": ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800","https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800"],
  "houses-sale": ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"],
  "phones-tablets": ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800","https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800"],
  laptops: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800","https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800"],
  computers: ["https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800"],
  gaming: ["https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800"],
  furniture: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800","https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800"],
  appliances: ["https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800"],
  bicycles: ["https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800","https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800"],
  "gym-equipment": ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800"],
  "womens-clothing": ["https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"],
  "mens-clothing": ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800"],
  shoes: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"],
  dogs: ["https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800"],
  cats: ["https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800"],
  "music-instruments": ["https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800"],
  "farm-equipment": ["https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=800"],
};

function findImages(title: string, categorySlug: string): string[] {
  for (const [regex, urls] of TITLE_IMAGE_MAP) {
    if (regex.test(title)) return urls;
  }
  return CATEGORY_FALLBACK[categorySlug] || ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800"];
}

async function main() {
  console.log("🖼️  Updating listing images to match content...\n");

  const listings = await db.listing.findMany({
    include: {
      images: true,
      category: { select: { slug: true, parent: { select: { slug: true } } } },
    },
  });

  let updated = 0;

  for (const listing of listings) {
    const catSlug = listing.category?.slug || "";
    const parentSlug = listing.category?.parent?.slug || "";
    const images = findImages(listing.title, catSlug || parentSlug);

    if (images.length === 0) continue;

    // Delete existing images
    await db.listingImage.deleteMany({ where: { listingId: listing.id } });

    // Create new matched images (1-2 per listing)
    const numImages = Math.min(images.length, 2);
    for (let i = 0; i < numImages; i++) {
      await db.listingImage.create({
        data: {
          listingId: listing.id,
          url: images[i],
          thumbnailUrl: images[i].replace("w=800", "w=200"),
          alt: listing.title,
          sortOrder: i,
          isPrimary: i === 0,
        },
      });
    }
    updated++;
  }

  console.log(`✅ Updated images for ${updated} listings`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); process.exit(0); });
