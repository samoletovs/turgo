/**
 * Database seed script
 * 12 main categories + subcategories, Baltic locations, plans
 *
 * Usage: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ──────────────────────────────────────────────
  // PLANS
  // ──────────────────────────────────────────────
  console.log("  → Plans");
  const plans = [
    {
      name: "FREE" as const,
      displayName: "Free",
      price: 0,
      interval: "MONTHLY" as const,
      maxListings: 5,
      maxPhotos: 5,
      maxAgents: 1,
      features: {
        basicAgent: true,
        premiumAgent: false,
        boostOptions: false,
        analytics: false,
        prioritySupport: false,
      },
    },
    {
      name: "PRO" as const,
      displayName: "Pro",
      price: 9.99,
      interval: "MONTHLY" as const,
      maxListings: 50,
      maxPhotos: 15,
      maxAgents: 5,
      stripeProductId: "prod_pro_monthly",
      stripePriceId: "price_pro_monthly",
      features: {
        basicAgent: true,
        premiumAgent: true,
        boostOptions: true,
        analytics: true,
        prioritySupport: false,
      },
    },
    {
      name: "PRO" as const,
      displayName: "Pro (Yearly)",
      price: 95.88,
      interval: "YEARLY" as const,
      maxListings: 50,
      maxPhotos: 15,
      maxAgents: 5,
      stripeProductId: "prod_pro_yearly",
      stripePriceId: "price_pro_yearly",
      features: {
        basicAgent: true,
        premiumAgent: true,
        boostOptions: true,
        analytics: true,
        prioritySupport: false,
      },
    },
    {
      name: "BUSINESS" as const,
      displayName: "Business",
      price: 29.99,
      interval: "MONTHLY" as const,
      maxListings: -1, // unlimited
      maxPhotos: 30,
      maxAgents: -1,
      stripeProductId: "prod_business_monthly",
      stripePriceId: "price_business_monthly",
      features: {
        basicAgent: true,
        premiumAgent: true,
        boostOptions: true,
        analytics: true,
        prioritySupport: true,
        apiAccess: true,
        whiteLabel: true,
      },
    },
    {
      name: "BUSINESS" as const,
      displayName: "Business (Yearly)",
      price: 287.88,
      interval: "YEARLY" as const,
      maxListings: -1,
      maxPhotos: 30,
      maxAgents: -1,
      stripeProductId: "prod_business_yearly",
      stripePriceId: "price_business_yearly",
      features: {
        basicAgent: true,
        premiumAgent: true,
        boostOptions: true,
        analytics: true,
        prioritySupport: true,
        apiAccess: true,
        whiteLabel: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        name_interval: { name: plan.name, interval: plan.interval },
      },
      update: plan,
      create: plan,
    });
  }

  // ──────────────────────────────────────────────
  // CATEGORIES (12 main + subcategories)
  // ──────────────────────────────────────────────
  console.log("  → Categories");

  const categories: { name: Record<string, string>; slug: string; icon: string; children: { name: Record<string, string>; slug: string }[] }[] = [
    {
      name: { en: "Transport", lv: "Transports", lt: "Transportas", et: "Transport", ru: "Транспорт" },
      slug: "transport",
      icon: "car",
      children: [
        { name: { en: "Cars", lv: "Automašīnas", lt: "Automobiliai", et: "Autod", ru: "Автомобили" }, slug: "cars" },
        { name: { en: "Motorcycles", lv: "Motocikli", lt: "Motociklai", et: "Mootorrattad", ru: "Мотоциклы" }, slug: "motorcycles" },
        { name: { en: "Trucks & Buses", lv: "Kravas auto un autobusi", lt: "Sunkvežimiai ir autobusai", et: "Veoautod ja bussid", ru: "Грузовики и автобусы" }, slug: "trucks-buses" },
        { name: { en: "Spare Parts", lv: "Rezerves daļas", lt: "Atsarginės dalys", et: "Varuosad", ru: "Запчасти" }, slug: "spare-parts" },
        { name: { en: "Tires & Wheels", lv: "Riepas un diski", lt: "Padangos ir ratlankiai", et: "Rehvid ja veljed", ru: "Шины и диски" }, slug: "tires-wheels" },
        { name: { en: "Boats", lv: "Laivas", lt: "Laivai", et: "Paadid", ru: "Лодки" }, slug: "boats" },
        { name: { en: "Bicycles", lv: "Velosipēdi", lt: "Dviračiai", et: "Jalgrattad", ru: "Велосипеды" }, slug: "bicycles" },
        { name: { en: "Other Transport", lv: "Cits transports", lt: "Kitas transportas", et: "Muu transport", ru: "Другой транспорт" }, slug: "other-transport" },
      ],
    },
    {
      name: { en: "Real Estate", lv: "Nekustamais īpašums", lt: "Nekilnojamasis turtas", et: "Kinnisvara", ru: "Недвижимость" },
      slug: "real-estate",
      icon: "home",
      children: [
        { name: { en: "Apartments - Sale", lv: "Dzīvokļi - Pārdod", lt: "Butai - Parduoda", et: "Korterid - Müük", ru: "Квартиры - Продажа" }, slug: "apartments-sale" },
        { name: { en: "Apartments - Rent", lv: "Dzīvokļi - Īrē", lt: "Butai - Nuoma", et: "Korterid - Üür", ru: "Квартиры - Аренда" }, slug: "apartments-rent" },
        { name: { en: "Houses - Sale", lv: "Mājas - Pārdod", lt: "Namai - Parduoda", et: "Majad - Müük", ru: "Дома - Продажа" }, slug: "houses-sale" },
        { name: { en: "Houses - Rent", lv: "Mājas - Īrē", lt: "Namai - Nuoma", et: "Majad - Üür", ru: "Дома - Аренда" }, slug: "houses-rent" },
        { name: { en: "Land", lv: "Zeme", lt: "Žemė", et: "Maa", ru: "Земля" }, slug: "land" },
        { name: { en: "Commercial", lv: "Komercīpašumi", lt: "Komercinis", et: "Äripinnad", ru: "Коммерческая" }, slug: "commercial-property" },
        { name: { en: "Garages", lv: "Garāžas", lt: "Garažai", et: "Garaažid", ru: "Гаражи" }, slug: "garages" },
      ],
    },
    {
      name: { en: "Electronics", lv: "Elektronika", lt: "Elektronika", et: "Elektroonika", ru: "Электроника" },
      slug: "electronics",
      icon: "smartphone",
      children: [
        { name: { en: "Phones & Tablets", lv: "Telefoni un planšetes", lt: "Telefonai ir planšetės", et: "Telefonid ja tahvlid", ru: "Телефоны и планшеты" }, slug: "phones-tablets" },
        { name: { en: "Computers", lv: "Datori", lt: "Kompiuteriai", et: "Arvutid", ru: "Компьютеры" }, slug: "computers" },
        { name: { en: "Laptops", lv: "Portatīvie datori", lt: "Nešiojami kompiuteriai", et: "Sülearvutid", ru: "Ноутбуки" }, slug: "laptops" },
        { name: { en: "TVs & Audio", lv: "TV un audio", lt: "TV ir garso technika", et: "TV ja heli", ru: "ТВ и аудио" }, slug: "tvs-audio" },
        { name: { en: "Gaming", lv: "Spēles", lt: "Žaidimai", et: "Mängud", ru: "Игры" }, slug: "gaming" },
        { name: { en: "Cameras", lv: "Kameras", lt: "Kameros", et: "Kaamerad", ru: "Камеры" }, slug: "cameras" },
        { name: { en: "Accessories", lv: "Piederumi", lt: "Priedai", et: "Tarvikud", ru: "Аксессуары" }, slug: "electronics-accessories" },
      ],
    },
    {
      name: { en: "Home & Garden", lv: "Māja un dārzs", lt: "Namai ir sodas", et: "Kodu ja aed", ru: "Дом и сад" },
      slug: "home-garden",
      icon: "sofa",
      children: [
        { name: { en: "Furniture", lv: "Mēbeles", lt: "Baldai", et: "Mööbel", ru: "Мебель" }, slug: "furniture" },
        { name: { en: "Appliances", lv: "Sadzīves tehnika", lt: "Buitinė technika", et: "Kodumasinad", ru: "Бытовая техника" }, slug: "appliances" },
        { name: { en: "Tools", lv: "Instrumenti", lt: "Įrankiai", et: "Tööriistad", ru: "Инструменты" }, slug: "tools" },
        { name: { en: "Garden", lv: "Dārzs", lt: "Sodas", et: "Aed", ru: "Сад" }, slug: "garden" },
        { name: { en: "Renovation", lv: "Remonts", lt: "Remontas", et: "Remont", ru: "Ремонт" }, slug: "renovation" },
        { name: { en: "Decor", lv: "Dekors", lt: "Dekoras", et: "Dekoratsioonid", ru: "Декор" }, slug: "decor" },
      ],
    },
    {
      name: { en: "Fashion", lv: "Mode", lt: "Mada", et: "Mood", ru: "Мода" },
      slug: "fashion",
      icon: "shirt",
      children: [
        { name: { en: "Women's Clothing", lv: "Sieviešu apģērbs", lt: "Moteriški drabužiai", et: "Naiste riided", ru: "Женская одежда" }, slug: "womens-clothing" },
        { name: { en: "Men's Clothing", lv: "Vīriešu apģērbs", lt: "Vyriški drabužiai", et: "Meeste riided", ru: "Мужская одежда" }, slug: "mens-clothing" },
        { name: { en: "Children's Clothing", lv: "Bērnu apģērbs", lt: "Vaikiški drabužiai", et: "Laste riided", ru: "Детская одежда" }, slug: "childrens-clothing" },
        { name: { en: "Shoes", lv: "Apavi", lt: "Batai", et: "Jalanõud", ru: "Обувь" }, slug: "shoes" },
        { name: { en: "Bags & Accessories", lv: "Somas un aksesuāri", lt: "Krepšiai ir aksesuarai", et: "Kotid ja aksessuaarid", ru: "Сумки и аксессуары" }, slug: "bags-accessories" },
        { name: { en: "Watches & Jewelry", lv: "Pulksteņi un rotaslietas", lt: "Laikrodžiai ir papuošalai", et: "Kellad ja ehted", ru: "Часы и украшения" }, slug: "watches-jewelry" },
      ],
    },
    {
      name: { en: "Jobs", lv: "Darbs", lt: "Darbas", et: "Töö", ru: "Работа" },
      slug: "jobs",
      icon: "briefcase",
      children: [
        { name: { en: "IT & Telecom", lv: "IT un telekomunikācijas", lt: "IT ir telekomunikacijos", et: "IT ja telekommunikatsioon", ru: "IT и телеком" }, slug: "it-telecom" },
        { name: { en: "Finance & Accounting", lv: "Finanses un grāmatvedība", lt: "Finansai ir apskaita", et: "Rahandus ja raamatupidamine", ru: "Финансы и бухгалтерия" }, slug: "finance-accounting" },
        { name: { en: "Sales & Marketing", lv: "Pārdošana un mārketings", lt: "Pardavimai ir rinkodara", et: "Müük ja turundus", ru: "Продажи и маркетинг" }, slug: "sales-marketing" },
        { name: { en: "Construction", lv: "Būvniecība", lt: "Statyba", et: "Ehitus", ru: "Строительство" }, slug: "construction-jobs" },
        { name: { en: "Healthcare", lv: "Veselības aprūpe", lt: "Sveikatos priežiūra", et: "Tervishoid", ru: "Здравоохранение" }, slug: "healthcare-jobs" },
        { name: { en: "Education", lv: "Izglītība", lt: "Švietimas", et: "Haridus", ru: "Образование" }, slug: "education-jobs" },
        { name: { en: "Service Industry", lv: "Pakalpojumu nozare", lt: "Paslaugų sektorius", et: "Teenindus", ru: "Сфера услуг" }, slug: "service-industry" },
        { name: { en: "Other Jobs", lv: "Citi darbi", lt: "Kiti darbai", et: "Muud tööd", ru: "Другая работа" }, slug: "other-jobs" },
      ],
    },
    {
      name: { en: "Services", lv: "Pakalpojumi", lt: "Paslaugos", et: "Teenused", ru: "Услуги" },
      slug: "services",
      icon: "wrench",
      children: [
        { name: { en: "Construction & Repair", lv: "Būvniecība un remonts", lt: "Statyba ir remontas", et: "Ehitus ja remont", ru: "Строительство и ремонт" }, slug: "construction-repair" },
        { name: { en: "Transportation", lv: "Transportēšana", lt: "Transportavimas", et: "Veoteenused", ru: "Перевозки" }, slug: "transportation-services" },
        { name: { en: "Beauty & Health", lv: "Skaistums un veselība", lt: "Grožis ir sveikata", et: "Ilu ja tervis", ru: "Красота и здоровье" }, slug: "beauty-health" },
        { name: { en: "Education & Tutoring", lv: "Izglītība un korepetīcijas", lt: "Švietimas ir korepetavimas", et: "Haridus ja koolitused", ru: "Образование и репетиторство" }, slug: "education-tutoring" },
        { name: { en: "IT Services", lv: "IT pakalpojumi", lt: "IT paslaugos", et: "IT teenused", ru: "IT-услуги" }, slug: "it-services" },
        { name: { en: "Other Services", lv: "Citi pakalpojumi", lt: "Kitos paslaugos", et: "Muud teenused", ru: "Другие услуги" }, slug: "other-services" },
      ],
    },
    {
      name: { en: "Kids & Baby", lv: "Bērniem", lt: "Vaikams", et: "Lastele", ru: "Детям" },
      slug: "kids-baby",
      icon: "baby",
      children: [
        { name: { en: "Strollers", lv: "Ratiņi", lt: "Vežimėliai", et: "Kärud", ru: "Коляски" }, slug: "strollers" },
        { name: { en: "Toys", lv: "Rotaļlietas", lt: "Žaislai", et: "Mänguasjad", ru: "Игрушки" }, slug: "toys" },
        { name: { en: "Baby Clothes", lv: "Bērnu apģērbs", lt: "Kūdikių drabužiai", et: "Beebi riided", ru: "Детская одежда" }, slug: "baby-clothes" },
        { name: { en: "Furniture & Safety", lv: "Mēbeles un drošība", lt: "Baldai ir sauga", et: "Mööbel ja ohutus", ru: "Мебель и безопасность" }, slug: "kids-furniture" },
        { name: { en: "School Supplies", lv: "Skolas piederumi", lt: "Mokyklinės prekės", et: "Koolitarbed", ru: "Школьные принадлежности" }, slug: "school-supplies" },
      ],
    },
    {
      name: { en: "Sports & Outdoors", lv: "Sports un atpūta", lt: "Sportas ir laisvalaikis", et: "Sport ja vaba aeg", ru: "Спорт и отдых" },
      slug: "sports-outdoors",
      icon: "dumbbell",
      children: [
        { name: { en: "Gym Equipment", lv: "Trenažieri", lt: "Treniruokliai", et: "Treeningvarustus", ru: "Тренажёры" }, slug: "gym-equipment" },
        { name: { en: "Winter Sports", lv: "Ziemas sports", lt: "Žiemos sportas", et: "Talvesport", ru: "Зимний спорт" }, slug: "winter-sports" },
        { name: { en: "Water Sports", lv: "Ūdens sports", lt: "Vandens sportas", et: "Veesport", ru: "Водный спорт" }, slug: "water-sports" },
        { name: { en: "Camping & Hiking", lv: "Kempings un pārgājieni", lt: "Stovyklavimas ir žygiai", et: "Matkamine", ru: "Кемпинг и походы" }, slug: "camping-hiking" },
        { name: { en: "Team Sports", lv: "Komandu sports", lt: "Komandinės sporto šakos", et: "Võistkonnasport", ru: "Командный спорт" }, slug: "team-sports" },
        { name: { en: "Fishing & Hunting", lv: "Makšķerēšana un medības", lt: "Žvejyba ir medžioklė", et: "Kalastamine ja jaht", ru: "Рыбалка и охота" }, slug: "fishing-hunting" },
      ],
    },
    {
      name: { en: "Pets", lv: "Dzīvnieki", lt: "Gyvūnai", et: "Loomad", ru: "Животные" },
      slug: "pets",
      icon: "paw-print",
      children: [
        { name: { en: "Dogs", lv: "Suņi", lt: "Šunys", et: "Koerad", ru: "Собаки" }, slug: "dogs" },
        { name: { en: "Cats", lv: "Kaķi", lt: "Katės", et: "Kassid", ru: "Кошки" }, slug: "cats" },
        { name: { en: "Birds", lv: "Putni", lt: "Paukščiai", et: "Linnud", ru: "Птицы" }, slug: "birds" },
        { name: { en: "Fish & Aquariums", lv: "Zivis un akvāriji", lt: "Žuvys ir akvariumai", et: "Kalad ja akvaariumid", ru: "Рыбки и аквариумы" }, slug: "fish-aquariums" },
        { name: { en: "Pet Supplies", lv: "Mājdzīvnieku preces", lt: "Prekės gyvūnams", et: "Loomakaubad", ru: "Зоотовары" }, slug: "pet-supplies" },
        { name: { en: "Other Animals", lv: "Citi dzīvnieki", lt: "Kiti gyvūnai", et: "Muud loomad", ru: "Другие животные" }, slug: "other-animals" },
      ],
    },
    {
      name: { en: "Hobbies & Leisure", lv: "Hobiji un brīvais laiks", lt: "Pomėgiai ir pramogos", et: "Hobid ja meelelahutus", ru: "Хобби и досуг" },
      slug: "hobbies-leisure",
      icon: "palette",
      children: [
        { name: { en: "Books & Magazines", lv: "Grāmatas un žurnāli", lt: "Knygos ir žurnalai", et: "Raamatud ja ajakirjad", ru: "Книги и журналы" }, slug: "books-magazines" },
        { name: { en: "Music & Instruments", lv: "Mūzika un instrumenti", lt: "Muzika ir instrumentai", et: "Muusika ja pillid", ru: "Музыка и инструменты" }, slug: "music-instruments" },
        { name: { en: "Collectibles", lv: "Kolekcionējamie", lt: "Kolekciniai", et: "Kollektsioonid", ru: "Коллекционирование" }, slug: "collectibles" },
        { name: { en: "Board Games", lv: "Galda spēles", lt: "Stalo žaidimai", et: "Lauamängud", ru: "Настольные игры" }, slug: "board-games" },
        { name: { en: "Tickets & Events", lv: "Biļetes un pasākumi", lt: "Bilietai ir renginiai", et: "Piletid ja üritused", ru: "Билеты и мероприятия" }, slug: "tickets-events" },
      ],
    },
    {
      name: { en: "Agriculture", lv: "Lauksaimniecība", lt: "Žemės ūkis", et: "Põllumajandus", ru: "Сельское хозяйство" },
      slug: "agriculture",
      icon: "tractor",
      children: [
        { name: { en: "Farm Equipment", lv: "Lauksaimniecības tehnika", lt: "Žemės ūkio technika", et: "Põllumajandustehnika", ru: "Сельхозтехника" }, slug: "farm-equipment" },
        { name: { en: "Livestock", lv: "Mājlopi", lt: "Gyvuliai", et: "Kariloomad", ru: "Скот" }, slug: "livestock" },
        { name: { en: "Seeds & Plants", lv: "Sēklas un stādi", lt: "Sėklos ir augalai", et: "Seemned ja taimed", ru: "Семена и растения" }, slug: "seeds-plants" },
        { name: { en: "Forestry", lv: "Mežsaimniecība", lt: "Miškininkystė", et: "Metsandus", ru: "Лесное хозяйство" }, slug: "forestry" },
      ],
    },
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, sortOrder: i },
      create: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        sortOrder: i,
      },
    });

    for (let j = 0; j < cat.children.length; j++) {
      const child = cat.children[j];
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id, sortOrder: j },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
          sortOrder: j,
        },
      });
    }
  }

  // ──────────────────────────────────────────────
  // BALTIC LOCATIONS
  // ──────────────────────────────────────────────
  console.log("  → Baltic locations");

  const locations: {
    name: string;
    slug: string;
    type: "COUNTRY" | "REGION" | "CITY";
    children?: { name: string; slug: string; type: "REGION" | "CITY"; children?: { name: string; slug: string; type: "CITY" }[] }[];
  }[] = [
    {
      name: "Latvia",
      slug: "latvia",
      type: "COUNTRY",
      children: [
        {
          name: "Rīga",
          slug: "riga",
          type: "CITY",
        },
        {
          name: "Rīgas reģions",
          slug: "riga-region",
          type: "REGION",
          children: [
            { name: "Jūrmala", slug: "jurmala", type: "CITY" },
            { name: "Ādaži", slug: "adazi", type: "CITY" },
            { name: "Mārupe", slug: "marupe", type: "CITY" },
            { name: "Salaspils", slug: "salaspils", type: "CITY" },
            { name: "Sigulda", slug: "sigulda", type: "CITY" },
            { name: "Ogre", slug: "ogre", type: "CITY" },
          ],
        },
        {
          name: "Kurzeme",
          slug: "kurzeme",
          type: "REGION",
          children: [
            { name: "Liepāja", slug: "liepaja", type: "CITY" },
            { name: "Ventspils", slug: "ventspils", type: "CITY" },
            { name: "Kuldīga", slug: "kuldiga", type: "CITY" },
            { name: "Talsi", slug: "talsi", type: "CITY" },
          ],
        },
        {
          name: "Vidzeme",
          slug: "vidzeme",
          type: "REGION",
          children: [
            { name: "Valmiera", slug: "valmiera", type: "CITY" },
            { name: "Cēsis", slug: "cesis", type: "CITY" },
            { name: "Smiltene", slug: "smiltene", type: "CITY" },
            { name: "Madona", slug: "madona", type: "CITY" },
          ],
        },
        {
          name: "Latgale",
          slug: "latgale",
          type: "REGION",
          children: [
            { name: "Daugavpils", slug: "daugavpils", type: "CITY" },
            { name: "Rēzekne", slug: "rezekne", type: "CITY" },
            { name: "Jēkabpils", slug: "jekabpils", type: "CITY" },
            { name: "Preiļi", slug: "preili", type: "CITY" },
          ],
        },
        {
          name: "Zemgale",
          slug: "zemgale",
          type: "REGION",
          children: [
            { name: "Jelgava", slug: "jelgava", type: "CITY" },
            { name: "Bauska", slug: "bauska", type: "CITY" },
            { name: "Tukums", slug: "tukums", type: "CITY" },
            { name: "Dobele", slug: "dobele", type: "CITY" },
          ],
        },
      ],
    },
    {
      name: "Lithuania",
      slug: "lithuania",
      type: "COUNTRY",
      children: [
        { name: "Vilnius", slug: "vilnius", type: "CITY" },
        { name: "Kaunas", slug: "kaunas", type: "CITY" },
        { name: "Klaipėda", slug: "klaipeda", type: "CITY" },
        { name: "Šiauliai", slug: "siauliai", type: "CITY" },
        { name: "Panevėžys", slug: "panevezys", type: "CITY" },
        { name: "Alytus", slug: "alytus", type: "CITY" },
        { name: "Marijampolė", slug: "marijampole", type: "CITY" },
        { name: "Utena", slug: "utena", type: "CITY" },
        { name: "Telšiai", slug: "telsiai", type: "CITY" },
        { name: "Tauragė", slug: "taurage", type: "CITY" },
      ],
    },
    {
      name: "Estonia",
      slug: "estonia",
      type: "COUNTRY",
      children: [
        { name: "Tallinn", slug: "tallinn", type: "CITY" },
        { name: "Tartu", slug: "tartu", type: "CITY" },
        { name: "Narva", slug: "narva", type: "CITY" },
        { name: "Pärnu", slug: "parnu", type: "CITY" },
        { name: "Kohtla-Järve", slug: "kohtla-jarve", type: "CITY" },
        { name: "Viljandi", slug: "viljandi", type: "CITY" },
        { name: "Rakvere", slug: "rakvere", type: "CITY" },
        { name: "Kuressaare", slug: "kuressaare", type: "CITY" },
        { name: "Haapsalu", slug: "haapsalu", type: "CITY" },
      ],
    },
  ];

  async function seedLocation(
    loc: typeof locations[number],
    parentId: string | null = null
  ) {
    const record = await prisma.location.upsert({
      where: { slug: loc.slug },
      update: { name: loc.name, type: loc.type, parentId },
      create: {
        name: loc.name,
        slug: loc.slug,
        type: loc.type,
        parentId,
      },
    });

    if ("children" in loc && loc.children) {
      for (const child of loc.children) {
        await seedLocation(child as typeof locations[number], record.id);
      }
    }
  }

  for (const loc of locations) {
    await seedLocation(loc);
  }

  // ──────────────────────────────────────────────
  // CATEGORY ATTRIBUTES (key attributes per category)
  // ──────────────────────────────────────────────
  console.log("  → Category attributes");

  const carsCat = await prisma.category.findUnique({ where: { slug: "cars" } });
  if (carsCat) {
    // Delete existing attributes and recreate
    await prisma.categoryAttribute.deleteMany({ where: { categoryId: carsCat.id } });

    const carAttributes = [
      { name: { en: "Brand" }, type: "SELECT" as const, options: ["Audi", "BMW", "Ford", "Honda", "Mazda", "Mercedes-Benz", "Opel", "Toyota", "Volkswagen", "Volvo", "Other"], isRequired: true },
      { name: { en: "Year" }, type: "NUMBER" as const, isRequired: true },
      { name: { en: "Mileage (km)" }, type: "NUMBER" as const, isRequired: true },
      { name: { en: "Engine (L)" }, type: "NUMBER" as const, isRequired: false },
      { name: { en: "Fuel Type" }, type: "SELECT" as const, options: ["Petrol", "Diesel", "Electric", "Hybrid", "LPG"], isRequired: true },
      { name: { en: "Transmission" }, type: "SELECT" as const, options: ["Manual", "Automatic"], isRequired: true },
      { name: { en: "Body Type" }, type: "SELECT" as const, options: ["Sedan", "Hatchback", "SUV", "Wagon", "Coupe", "Convertible", "Minivan", "Pickup"], isRequired: false },
      { name: { en: "Technical Inspection" }, type: "BOOLEAN" as const, isRequired: false },
    ];

    for (let i = 0; i < carAttributes.length; i++) {
      const attr = carAttributes[i];
      await prisma.categoryAttribute.create({
        data: {
          categoryId: carsCat.id,
          name: attr.name,
          type: attr.type,
          options: attr.options || [],
          isRequired: attr.isRequired,
          sortOrder: i,
        },
      });
    }
  }

  const aptSaleCat = await prisma.category.findUnique({ where: { slug: "apartments-sale" } });
  if (aptSaleCat) {
    await prisma.categoryAttribute.deleteMany({ where: { categoryId: aptSaleCat.id } });

    const aptAttributes = [
      { name: { en: "Rooms" }, type: "NUMBER" as const, isRequired: true },
      { name: { en: "Area (m²)" }, type: "NUMBER" as const, isRequired: true },
      { name: { en: "Floor" }, type: "NUMBER" as const, isRequired: false },
      { name: { en: "Total Floors" }, type: "NUMBER" as const, isRequired: false },
      { name: { en: "Building Type" }, type: "SELECT" as const, options: ["New Project", "Renovated", "Soviet Brick", "Soviet Panel", "Pre-war", "Wooden"], isRequired: false },
      { name: { en: "Elevator" }, type: "BOOLEAN" as const, isRequired: false },
      { name: { en: "Parking" }, type: "BOOLEAN" as const, isRequired: false },
    ];

    for (let i = 0; i < aptAttributes.length; i++) {
      const attr = aptAttributes[i];
      await prisma.categoryAttribute.create({
        data: {
          categoryId: aptSaleCat.id,
          name: attr.name,
          type: attr.type,
          options: attr.options || [],
          isRequired: attr.isRequired,
          sortOrder: i,
        },
      });
    }
  }

  const phonesCat = await prisma.category.findUnique({ where: { slug: "phones-tablets" } });
  if (phonesCat) {
    await prisma.categoryAttribute.deleteMany({ where: { categoryId: phonesCat.id } });

    const phonesAttributes = [
      { name: { en: "Brand" }, type: "SELECT" as const, options: ["Apple", "Samsung", "Google", "Xiaomi", "Huawei", "OnePlus", "Other"], isRequired: true },
      { name: { en: "Storage (GB)" }, type: "NUMBER" as const, isRequired: false },
      { name: { en: "Color" }, type: "TEXT" as const, isRequired: false },
    ];

    for (let i = 0; i < phonesAttributes.length; i++) {
      const attr = phonesAttributes[i];
      await prisma.categoryAttribute.create({
        data: {
          categoryId: phonesCat.id,
          name: attr.name,
          type: attr.type,
          options: attr.options || [],
          isRequired: attr.isRequired,
          sortOrder: i,
        },
      });
    }
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
