/**
 * Generate 120+ realistic test listings with staggered recent dates.
 * Usage: npx tsx scripts/generate-listings.mts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.round(min + Math.random() * (max - min)); }
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").substring(0, 60) + "-" + rand(10000, 99999);
}
function recentDate(maxDaysAgo: number): Date {
  return new Date(Date.now() - rand(0, maxDaysAgo * 24 * 60 * 60 * 1000));
}

const IMAGES: Record<string, string[]> = {
  cars: ["https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800","https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800","https://images.unsplash.com/photo-1542362567-b07e54358753?w=800","https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800","https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800"],
  apartments: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800","https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800","https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800","https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800"],
  electronics: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800","https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800","https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800","https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800","https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800"],
  furniture: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800","https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800","https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800","https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?w=800"],
  sports: ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800","https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800","https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800"],
  fashion: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800","https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800","https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"],
  pets: ["https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=800","https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800","https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800"],
  houses: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"],
  general: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800","https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800","https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=800"],
};

interface Template { title: string; desc: string; priceMin: number; priceMax: number; condition: "NEW" | "USED" | "REFURBISHED"; }
interface ListingData { categorySlug: string; imageCategory: string; templates: Template[]; }

const LISTING_DATA: ListingData[] = [
  { categorySlug: "cars", imageCategory: "cars", templates: [
    { title: "Toyota Corolla 1.8 Hybrid, {year}, {km} km", desc: "Toyota Corolla Hybrid, automātiskā pārnesumkārba, ekonomisks patēriņš 4-5L/100km. LED lukturi, atpakaļskata kamera.", priceMin: 14000, priceMax: 28000, condition: "USED" },
    { title: "Honda Civic 1.5 VTEC Turbo, {year}, {km} km", desc: "Honda Civic 1.5 VTEC Turbo Sport. Navigācija, ādas salons, elektroniski regulējami sēdekļi.", priceMin: 16000, priceMax: 29000, condition: "USED" },
    { title: "Volvo XC60 D4 AWD, {year}, {km} km", desc: "Volvo XC60 D4 AWD Inscription. Pilot Assist, 360° kamera, Harman/Kardon skaņas sistēma.", priceMin: 22000, priceMax: 42000, condition: "USED" },
    { title: "Škoda Octavia 2.0 TDI DSG, {year}, {km} km", desc: "Škoda Octavia Combi Style 2.0 TDI 150 ZS, DSG. Canton skaņas sistēma, virtuālais kokpits.", priceMin: 15000, priceMax: 32000, condition: "USED" },
    { title: "Ford Focus 1.0 EcoBoost, {year}, {km} km", desc: "Ford Focus 1.0 EcoBoost 125 ZS. Sync 3 multimēdija, navigācija, kruīza kontrole.", priceMin: 8000, priceMax: 18000, condition: "USED" },
    { title: "Mazda CX-5 2.5 Skyactiv-G, {year}, {km} km", desc: "Mazda CX-5 2.5 Skyactiv-G AWD. Bose skaņas sistēma, ādas salons, G-Vectoring Control.", priceMin: 18000, priceMax: 35000, condition: "USED" },
    { title: "Hyundai Tucson 1.6 T-GDI HEV, {year}, {km} km", desc: "Hyundai Tucson Hybrid 1.6 T-GDI. Moderns dizains, pilnīgi digitāls panelis, Krell skaņas sistēma.", priceMin: 20000, priceMax: 36000, condition: "USED" },
    { title: "Kia Sportage 1.6 CRDi, {year}, {km} km", desc: "Kia Sportage GT-Line. Panorāmas jumts, adaptīvais kruīzs. 7 gadu garantija.", priceMin: 16000, priceMax: 33000, condition: "USED" },
    { title: "Renault Clio 1.0 TCe, {year}, {km} km", desc: "Renault Clio 1.0 TCe 100 ZS. Kompakts pilsētas auto, Easy Link multimēdija, LED lukturi.", priceMin: 7000, priceMax: 15000, condition: "USED" },
    { title: "Nissan Qashqai 1.3 DIG-T, {year}, {km} km", desc: "Nissan Qashqai Tekna+. ProPILOT asistents, Bose skaņa, panorāmas jumts, ādas salons.", priceMin: 17000, priceMax: 32000, condition: "USED" },
    { title: "Peugeot 308 1.5 BlueHDi, {year}, {km} km", desc: "Peugeot 308 1.5 BlueHDi 130 ZS. i-Cockpit digitālais panelis, navigācija, parka asistents.", priceMin: 12000, priceMax: 26000, condition: "USED" },
    { title: "Dacia Duster 1.5 dCi, {year}, {km} km", desc: "Dacia Duster 4x4 Prestige. Kruīza kontrole, MediaNav, 360° kamera. Uzticams un ekonomisks.", priceMin: 9000, priceMax: 20000, condition: "USED" },
  ]},
  { categorySlug: "apartments-sale", imageCategory: "apartments", templates: [
    { title: "2-istabu dzīvoklis {district}, {area} m²", desc: "Renovēts 2-istabu dzīvoklis. Kvalitatīvs remonts, iebūvēta virtuve. Siltināta ēka, zemi komunālie.", priceMin: 65000, priceMax: 160000, condition: "USED" },
    { title: "3-istabu dzīvoklis {district}, {area} m²", desc: "Plašs 3-istabu dzīvoklis ar kvalitatīvu remontu. Iebūvēta virtuve, 2 balkoni. Skats uz parku.", priceMin: 95000, priceMax: 250000, condition: "USED" },
    { title: "1-istabas studija {district}, {area} m²", desc: "Moderna studija tipa dzīvoklis jaunajā projektā. Atvērta plānojuma virtuve-dzīvojamā istaba.", priceMin: 45000, priceMax: 120000, condition: "NEW" },
    { title: "4-istabu dzīvoklis {district}, {area} m²", desc: "Ģimenes dzīvoklis ar 4 istabām, 2 vannas istabām. Pilnībā renovēta 2023. gadā.", priceMin: 150000, priceMax: 350000, condition: "USED" },
    { title: "2-istabu jaunajā projektā, {area} m²", desc: "Dzīvoklis ar A energoefektivitātes klasi. Pilna apdare, iebūvēta virtuve. Pazemes autostāvvieta.", priceMin: 110000, priceMax: 220000, condition: "NEW" },
    { title: "Dzīvoklis renovētā ēkā, {district}, {area} m²", desc: "Dzīvoklis jūgendstila ēkā. Augsti griesti 3.2m, parketa grīdas. Moderna virtuve.", priceMin: 120000, priceMax: 280000, condition: "USED" },
  ]},
  { categorySlug: "apartments-rent", imageCategory: "apartments", templates: [
    { title: "Izīrē 1-istabu dzīvokli {district}, {area} m²", desc: "Mēbelēts 1-istabu dzīvoklis ar remontu. Veļasmašīna, ledusskapja, plīts. Komunālie ~80 EUR/mēn.", priceMin: 300, priceMax: 550, condition: "USED" },
    { title: "Izīrē 2-istabu dzīvokli {district}, {area} m²", desc: "Mēbelēts 2-istabu dzīvoklis ar pilnu aprīkojumu. Internets iekļauts. Mierīgs rajons.", priceMin: 400, priceMax: 750, condition: "USED" },
    { title: "Izīrē modernu studiju {district}, {area} m²", desc: "Moderna studija ar visu nepieciešamo. Jauna mēbeles un tehnika. Komunālie iekļauti.", priceMin: 350, priceMax: 600, condition: "USED" },
    { title: "Izīrē 3-istabu dzīvokli {district}, {area} m²", desc: "Plašs 3-istabu dzīvoklis ģimenei. Pilnībā mēbelēts, moderna virtuve. Slēgts pagalms.", priceMin: 550, priceMax: 1100, condition: "USED" },
  ]},
  { categorySlug: "phones-tablets", imageCategory: "electronics", templates: [
    { title: "iPhone 14 Pro 128GB {color}", desc: "iPhone 14 Pro 128GB. Lieliski uzturēts, bez skrāpējumiem. Akumulatora veselība 93%. Kaste komplektā.", priceMin: 550, priceMax: 800, condition: "USED" },
    { title: "Samsung Galaxy S23 256GB", desc: "Samsung Galaxy S23 256GB, lieliski saglabāts. Ekrāns bez defektiem. Oriģinālā kaste.", priceMin: 400, priceMax: 650, condition: "USED" },
    { title: "Google Pixel 8 Pro 128GB", desc: "Google Pixel 8 Pro ar izcilu kameru. Tīrs Android, ātrākie atjauninājumi. Perfekts stāvoklis.", priceMin: 450, priceMax: 700, condition: "USED" },
    { title: "iPad Air M2 256GB Wi-Fi", desc: "Apple iPad Air ar M2 čipu, 256GB. Lietots pāris mēnešus. Ideāls darbam un mācībām.", priceMin: 500, priceMax: 750, condition: "USED" },
    { title: "Xiaomi 14 Ultra 512GB", desc: "Xiaomi 14 Ultra ar Leica kamerām. 512GB atmiņa, Snapdragon 8 Gen 3. Garantijā.", priceMin: 550, priceMax: 850, condition: "USED" },
    { title: "iPhone 16 128GB {color}, jauns", desc: "Jauns, neatvērts iPhone 16 128GB. Pilna Apple garantija. Čeks pieejams.", priceMin: 800, priceMax: 950, condition: "NEW" },
  ]},
  { categorySlug: "laptops", imageCategory: "electronics", templates: [
    { title: "Dell XPS 15 9530, i7, 16GB, 512GB SSD", desc: "Dell XPS 15 ar OLED 3.5K ekrānu. Intel i7-13700H, 16GB DDR5, 512GB NVMe SSD.", priceMin: 800, priceMax: 1400, condition: "USED" },
    { title: "ASUS ROG Strix G16, RTX 4060, i7", desc: "ASUS ROG Strix G16 spēļu portatīvais. RTX 4060 8GB, 16GB DDR5, 1TB SSD. 165Hz ekrāns.", priceMin: 900, priceMax: 1500, condition: "USED" },
    { title: "MacBook Air 15\" M3 16GB/512GB", desc: "Apple MacBook Air 15 ar M3 čipu. 16GB RAM, 512GB SSD. Gandrīz jauns.", priceMin: 1100, priceMax: 1500, condition: "USED" },
    { title: "Acer Aspire 5, Ryzen 7, 16GB, 512GB", desc: "Acer Aspire 5 ar AMD Ryzen 7, 16GB RAM, 512GB SSD. 15.6 Full HD IPS.", priceMin: 400, priceMax: 700, condition: "USED" },
  ]},
  { categorySlug: "furniture", imageCategory: "furniture", templates: [
    { title: "Ādas stūra dīvāns, tumši brūns", desc: "Kvalitatīvs ādas stūra dīvāns. Tumši brūna dabīgā āda, L-forma. 280x200 cm.", priceMin: 400, priceMax: 1200, condition: "USED" },
    { title: "Ozolkoka ēdamistabas galds + 6 krēsli", desc: "Masīvkoka ozola galds ar 6 krēsliem. Izvelkams no 160 līdz 220 cm.", priceMin: 300, priceMax: 900, condition: "USED" },
    { title: "Biroja galds ar regulējamu augstumu", desc: "Elektriskais sit-stand biroja galds. 160x80 cm, augstums 65-125 cm. Memory funkcija.", priceMin: 200, priceMax: 600, condition: "USED" },
    { title: "IKEA KALLAX plaukts 4x4, balts", desc: "IKEA KALLAX 4x4. Balta krāsa. Komplektā 4 ieliktņi ar durvīm. 147x147 cm.", priceMin: 50, priceMax: 120, condition: "USED" },
  ]},
  { categorySlug: "bicycles", imageCategory: "sports", templates: [
    { title: "Trek Marlin 7, 2024, {size}", desc: "Trek Marlin 7 kalnu velosipēds. Shimano Deore, hidrauliskās bremzes, RockShox amortizators.", priceMin: 500, priceMax: 900, condition: "USED" },
    { title: "Specialized Allez Sprint, 56cm", desc: "Specialized Allez Sprint šosejas velosipēds. Carbon dakša, Shimano 105 grupa.", priceMin: 800, priceMax: 1500, condition: "USED" },
    { title: "Kalkhoff Endeavour e-velosipēds", desc: "Kalkhoff Endeavour ar Bosch Performance CX. 625Wh akumulators (~100km).", priceMin: 1500, priceMax: 3000, condition: "USED" },
  ]},
  { categorySlug: "gym-equipment", imageCategory: "sports", templates: [
    { title: "Skrejceliņš NordicTrack T7.5S", desc: "NordicTrack T7.5S. Ātrums līdz 18 km/h, slīpums līdz 12%. iFit savietojams.", priceMin: 400, priceMax: 800, condition: "USED" },
    { title: "Hanteļu komplekts 2.5-25kg + statīvs", desc: "Profesionāls hanteļu komplekts 2.5-25 kg pāri. Metāla statīvs iekļauts.", priceMin: 300, priceMax: 700, condition: "USED" },
    { title: "Concept2 RowErg airēšanas trenažieris", desc: "Concept2 RowErg ar PM5 monitoru. Zelta standarts airēšanas trenažieros.", priceMin: 600, priceMax: 1000, condition: "USED" },
  ]},
  { categorySlug: "womens-clothing", imageCategory: "fashion", templates: [
    { title: "Zara sieviešu rudens jaka, L", desc: "Zara oversize rudens/pavasara jaka. Tumši zaļa, siltināta. L izmērs.", priceMin: 25, priceMax: 60, condition: "USED" },
    { title: "COS vilnas kleita, S, melna", desc: "COS vilnas-kašmira kleita. Minimālistisks dizains, S izmērs, melna.", priceMin: 40, priceMax: 90, condition: "USED" },
  ]},
  { categorySlug: "mens-clothing", imageCategory: "fashion", templates: [
    { title: "Hugo Boss uzvalks, 50. izmērs", desc: "Hugo Boss Regular Fit uzvalks. Tumši zils, 100% vilna. Nēsāts 3 reizes.", priceMin: 150, priceMax: 350, condition: "USED" },
    { title: "Canada Goose Expedition Parka, L", desc: "Canada Goose Expedition Parka, L, melna. Oriģināla. Ideāla Baltijas ziemām.", priceMin: 400, priceMax: 750, condition: "USED" },
  ]},
  { categorySlug: "dogs", imageCategory: "pets", templates: [
    { title: "Franču buldoga kucēni, ar dokumentiem", desc: "Franču buldoga kucēni. Audzētava reģistrēta LKF. Čipēti, vakcinēti.", priceMin: 1500, priceMax: 3000, condition: "NEW" },
    { title: "Vācu aitu suņa kucēni", desc: "Vācu aitu suņa kucēni no audzētavas. Darba līniju asinis. Ciltsraksti, čips.", priceMin: 800, priceMax: 1800, condition: "NEW" },
  ]},
  { categorySlug: "cats", imageCategory: "pets", templates: [
    { title: "Britu īsspalvainie kaķēni, zilā krāsā", desc: "Tīršķirnes Britu īsspalvainie kaķēni. Vakcinēti, čipēti, ar pasi.", priceMin: 300, priceMax: 800, condition: "NEW" },
    { title: "Meinkūni kaķēni no audzētavas", desc: "Meinkūnu kaķēni. Vecāki ar HCM, PKD pārbaudēm. Labi socializēti.", priceMin: 500, priceMax: 1200, condition: "NEW" },
  ]},
  { categorySlug: "houses-sale", imageCategory: "houses", templates: [
    { title: "Privātmāja {district}, {area} m²", desc: "Pārdod privātmāju. Moderna virtuve. Apsildāma garāža. Sakārtots dārzs.", priceMin: 150000, priceMax: 500000, condition: "USED" },
    { title: "Jaunbūve {district}, {area} m²", desc: "Jauna māja ar pilnu apdari. A klase, siltumsūknis. 4 guļamistabas, 2 vannas.", priceMin: 200000, priceMax: 650000, condition: "NEW" },
  ]},
  { categorySlug: "computers", imageCategory: "electronics", templates: [
    { title: "Gaming PC: RTX 4070, Ryzen 7, 32GB", desc: "AMD Ryzen 7 7800X3D, RTX 4070 12GB, 32GB DDR5, 1TB NVMe SSD.", priceMin: 900, priceMax: 1600, condition: "USED" },
    { title: "iMac 24\" M3 16GB/512GB, 2024", desc: "Apple iMac 24 ar M3 čipu. 16GB RAM, 512GB SSD. Apple garantijā.", priceMin: 1200, priceMax: 1600, condition: "USED" },
  ]},
  { categorySlug: "gaming", imageCategory: "electronics", templates: [
    { title: "Nintendo Switch OLED + 3 spēles", desc: "Switch OLED, baltā krāsā. 3 spēles: Zelda TOTK, Mario Kart 8, Animal Crossing.", priceMin: 250, priceMax: 380, condition: "USED" },
    { title: "Xbox Series X 1TB + Game Pass", desc: "Xbox Series X 1TB ar 2 kontrolieriem. Game Pass Ultimate. 8 spēles iekļautas.", priceMin: 300, priceMax: 450, condition: "USED" },
  ]},
  { categorySlug: "music-instruments", imageCategory: "general", templates: [
    { title: "Roland FP-30X digitālais klavierbūzis", desc: "Roland FP-30X ar 88 svērtajiem taustiņiem. Bluetooth, USB. Statīvs un pedālis.", priceMin: 350, priceMax: 650, condition: "USED" },
    { title: "Fender Player Stratocaster, Sunburst", desc: "Fender Player Stratocaster. 3-Color Sunburst, kļavas grifs. Made in Mexico.", priceMin: 400, priceMax: 700, condition: "USED" },
  ]},
  { categorySlug: "appliances", imageCategory: "furniture", templates: [
    { title: "Samsung ledusskapis Side-by-Side, 612L", desc: "Samsung RS65R5411M9. 612L, ledus dozators. No Frost.", priceMin: 400, priceMax: 900, condition: "USED" },
    { title: "Bosch veļasmašīna Serie 6, 9kg", desc: "Bosch WAU28P40, 9kg, 1400 apgr/min. A+++. Anti-vibration.", priceMin: 250, priceMax: 450, condition: "USED" },
  ]},
  { categorySlug: "farm-equipment", imageCategory: "general", templates: [
    { title: "Kubota L3560 traktors, {year}", desc: "Kubota L3560 kompaktais traktors, 4WD. Hidrostatiskā transmisija.", priceMin: 15000, priceMax: 35000, condition: "USED" },
    { title: "Husqvarna Automower 450X robotpļāvējs", desc: "Husqvarna Automower 450X. Līdz 5000 m². GPS, lietotnes vadība.", priceMin: 1000, priceMax: 2500, condition: "USED" },
  ]},
];

const DISTRICTS = ["Centrā","Āgenskalnā","Teikā","Purvciemā","Imantā","Ziepniekkalnā","Mežaparkā","Čiekurkalnā","Bieriņos","Torņakalnā","Pļavniekos","Ķengaragā","Bolderājā","Vecmīlgrāvī"];
const COLORS = ["Black","White","Silver","Gold","Blue","Red","Green"];
const SIZES = ["S","M","L","XL"];

async function main() {
  console.log("🏗️  Generating test listings...\n");

  const locations = await db.location.findMany({ where: { type: "CITY" } });
  const users = await db.user.findMany({ take: 10 });
  if (!locations.length || !users.length) { console.error("❌ Run 'npx prisma db seed' first."); process.exit(1); }

  let created = 0, skipped = 0;

  for (const data of LISTING_DATA) {
    const category = await db.category.findUnique({ where: { slug: data.categorySlug } });
    if (!category) { console.warn(`  ⚠️  '${data.categorySlug}' not found`); continue; }

    for (const template of data.templates) {
      const variations = rand(1, 3);
      for (let v = 0; v < variations; v++) {
        const year = rand(2016, 2025), km = rand(15, 250) * 1000, area = rand(28, 130);
        const title = template.title
          .replace("{year}", String(year)).replace("{km}", String(km))
          .replace("{area}", String(area)).replace("{land}", String(rand(600, 2500)))
          .replace("{district}", pick(DISTRICTS)).replace("{size}", pick(SIZES))
          .replace("{color}", pick(COLORS)).replace("{hours}", String(rand(500, 5000)));
        const slug = slugify(title);
        const price = rand(template.priceMin, template.priceMax);
        const createdAt = recentDate(30);

        const existing = await db.listing.findUnique({ where: { slug } });
        if (existing) { skipped++; continue; }

        const listing = await db.listing.create({ data: {
          title, slug, description: template.desc, price, condition: template.condition, status: "ACTIVE",
          userId: pick(users).id, locationId: pick(locations).id, categoryId: category.id,
          contactPhone: `+371${rand(20000000, 29999999)}`, negotiable: Math.random() > 0.3,
          expiresAt: new Date(createdAt.getTime() + rand(14, 60) * 86400000), createdAt, updatedAt: createdAt,
        }});

        const images = IMAGES[data.imageCategory] || IMAGES.general;
        const numImages = rand(1, Math.min(3, images.length));
        const shuffled = [...images].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numImages; i++) {
          await db.listingImage.create({ data: {
            listingId: listing.id, url: shuffled[i], thumbnailUrl: shuffled[i].replace("w=800", "w=200"),
            alt: title, sortOrder: i, isPrimary: i === 0,
          }});
        }
        created++;
      }
    }
    console.log(`  ✅ ${data.categorySlug}`);
  }

  // Refresh dates on old existing seed listings
  console.log("\n📅 Refreshing dates on old listings...");
  const oldListings = await db.listing.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    select: { id: true },
  });
  for (const l of oldListings) {
    const d = recentDate(30);
    await db.listing.update({ where: { id: l.id }, data: { createdAt: d, updatedAt: d, expiresAt: new Date(d.getTime() + 30 * 86400000) } });
  }

  console.log(`\n🎉 Done! Created ${created} new listings (${skipped} skipped). Refreshed ${oldListings.length} old listing dates.`);
}

main().catch(e => { console.error("❌", e); process.exit(1); }).finally(async () => { await db.$disconnect(); await pool.end(); process.exit(0); });
