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
      price: 0,
      interval: "MONTHLY" as const,
      maxListings: 5,
      maxPhotosPerListing: 5,
      listingDurationDays: 30,
      maxSavedSearches: 3,
      maxSellingAgents: 1,
      maxBuyingAgents: 1,
      hasAiPremium: false,
      hasAnalytics: false,
      hasAutoTranslate: false,
      hasAutoNegotiate: false,
    },
    {
      name: "PRO" as const,
      price: 4.99,
      interval: "MONTHLY" as const,
      maxListings: 50,
      maxPhotosPerListing: 15,
      listingDurationDays: 60,
      maxSavedSearches: 20,
      maxSellingAgents: 5,
      maxBuyingAgents: 5,
      hasAiPremium: true,
      hasAnalytics: true,
      hasAutoTranslate: true,
      hasAutoNegotiate: true,
      stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
    },
    {
      name: "PRO" as const,
      price: 47.88,
      interval: "YEARLY" as const,
      maxListings: 50,
      maxPhotosPerListing: 15,
      listingDurationDays: 60,
      maxSavedSearches: 20,
      maxSellingAgents: 5,
      maxBuyingAgents: 5,
      hasAiPremium: true,
      hasAnalytics: true,
      hasAutoTranslate: true,
      hasAutoNegotiate: true,
      stripePriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly",
    },
    {
      name: "BUSINESS" as const,
      price: 19.99,
      interval: "MONTHLY" as const,
      maxListings: -1,
      maxPhotosPerListing: 30,
      listingDurationDays: 90,
      maxSavedSearches: -1,
      maxSellingAgents: -1,
      maxBuyingAgents: -1,
      hasAiPremium: true,
      hasAnalytics: true,
      hasAutoTranslate: true,
      hasAutoNegotiate: true,
      stripePriceId: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || "price_business_monthly",
    },
    {
      name: "BUSINESS" as const,
      price: 191.88,
      interval: "YEARLY" as const,
      maxListings: -1,
      maxPhotosPerListing: 30,
      listingDurationDays: 90,
      maxSavedSearches: -1,
      maxSellingAgents: -1,
      maxBuyingAgents: -1,
      hasAiPremium: true,
      hasAnalytics: true,
      hasAutoTranslate: true,
      hasAutoNegotiate: true,
      stripePriceId: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID || "price_business_yearly",
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

  type LocName = Record<string, string>;
  const locations: {
    name: LocName;
    slug: string;
    type: "COUNTRY" | "REGION" | "CITY";
    children?: { name: LocName; slug: string; type: "REGION" | "CITY"; children?: { name: LocName; slug: string; type: "CITY" }[] }[];
  }[] = [
    {
      name: { en: "Latvia", lv: "Latvija", lt: "Latvija", et: "Läti", ru: "Латвия" },
      slug: "latvia",
      type: "COUNTRY",
      children: [
        {
          name: { en: "Riga", lv: "Rīga", lt: "Ryga", et: "Riia", ru: "Рига" },
          slug: "riga",
          type: "CITY",
        },
        {
          name: { en: "Riga Region", lv: "Rīgas reģions", lt: "Rygos regionas", et: "Riia piirkond", ru: "Рижский регион" },
          slug: "riga-region",
          type: "REGION",
          children: [
            { name: { en: "Jūrmala", lv: "Jūrmala", lt: "Jūrmala", et: "Jūrmala", ru: "Юрмала" }, slug: "jurmala", type: "CITY" },
            { name: { en: "Ādaži", lv: "Ādaži", lt: "Ādaži", et: "Ādaži", ru: "Адажи" }, slug: "adazi", type: "CITY" },
            { name: { en: "Mārupe", lv: "Mārupe", lt: "Mārupe", et: "Mārupe", ru: "Марупе" }, slug: "marupe", type: "CITY" },
            { name: { en: "Salaspils", lv: "Salaspils", lt: "Salaspilis", et: "Salaspils", ru: "Саласпилс" }, slug: "salaspils", type: "CITY" },
            { name: { en: "Sigulda", lv: "Sigulda", lt: "Sigulda", et: "Sigulda", ru: "Сигулда" }, slug: "sigulda", type: "CITY" },
            { name: { en: "Ogre", lv: "Ogre", lt: "Ogrė", et: "Ogre", ru: "Огре" }, slug: "ogre", type: "CITY" },
          ],
        },
        {
          name: { en: "Kurzeme", lv: "Kurzeme", lt: "Kuržemė", et: "Kurzeme", ru: "Курземе" },
          slug: "kurzeme",
          type: "REGION",
          children: [
            { name: { en: "Liepāja", lv: "Liepāja", lt: "Liepoja", et: "Liepāja", ru: "Лиепая" }, slug: "liepaja", type: "CITY" },
            { name: { en: "Ventspils", lv: "Ventspils", lt: "Ventspilis", et: "Ventspils", ru: "Вентспилс" }, slug: "ventspils", type: "CITY" },
            { name: { en: "Kuldīga", lv: "Kuldīga", lt: "Kuldyga", et: "Kuldīga", ru: "Кулдига" }, slug: "kuldiga", type: "CITY" },
            { name: { en: "Talsi", lv: "Talsi", lt: "Talsi", et: "Talsi", ru: "Талси" }, slug: "talsi", type: "CITY" },
          ],
        },
        {
          name: { en: "Vidzeme", lv: "Vidzeme", lt: "Vidžemė", et: "Vidzeme", ru: "Видземе" },
          slug: "vidzeme",
          type: "REGION",
          children: [
            { name: { en: "Valmiera", lv: "Valmiera", lt: "Valmiera", et: "Valmiera", ru: "Валмиера" }, slug: "valmiera", type: "CITY" },
            { name: { en: "Cēsis", lv: "Cēsis", lt: "Cēsis", et: "Cēsis", ru: "Цесис" }, slug: "cesis", type: "CITY" },
            { name: { en: "Smiltene", lv: "Smiltene", lt: "Smiltenė", et: "Smiltene", ru: "Смилтене" }, slug: "smiltene", type: "CITY" },
            { name: { en: "Madona", lv: "Madona", lt: "Madona", et: "Madona", ru: "Мадона" }, slug: "madona", type: "CITY" },
          ],
        },
        {
          name: { en: "Latgale", lv: "Latgale", lt: "Latgala", et: "Latgale", ru: "Латгале" },
          slug: "latgale",
          type: "REGION",
          children: [
            { name: { en: "Daugavpils", lv: "Daugavpils", lt: "Daugpilis", et: "Daugavpils", ru: "Даугавпилс" }, slug: "daugavpils", type: "CITY" },
            { name: { en: "Rēzekne", lv: "Rēzekne", lt: "Rėzeknė", et: "Rēzekne", ru: "Резекне" }, slug: "rezekne", type: "CITY" },
            { name: { en: "Jēkabpils", lv: "Jēkabpils", lt: "Jēkabpilis", et: "Jēkabpils", ru: "Екабпилс" }, slug: "jekabpils", type: "CITY" },
            { name: { en: "Preiļi", lv: "Preiļi", lt: "Preiļi", et: "Preiļi", ru: "Прейли" }, slug: "preili", type: "CITY" },
          ],
        },
        {
          name: { en: "Zemgale", lv: "Zemgale", lt: "Žiemgala", et: "Zemgale", ru: "Земгале" },
          slug: "zemgale",
          type: "REGION",
          children: [
            { name: { en: "Jelgava", lv: "Jelgava", lt: "Jelgava", et: "Jelgava", ru: "Елгава" }, slug: "jelgava", type: "CITY" },
            { name: { en: "Bauska", lv: "Bauska", lt: "Bauska", et: "Bauska", ru: "Бауска" }, slug: "bauska", type: "CITY" },
            { name: { en: "Tukums", lv: "Tukums", lt: "Tukumas", et: "Tukums", ru: "Тукумс" }, slug: "tukums", type: "CITY" },
            { name: { en: "Dobele", lv: "Dobele", lt: "Dobelė", et: "Dobele", ru: "Добеле" }, slug: "dobele", type: "CITY" },
          ],
        },
      ],
    },
    {
      name: { en: "Lithuania", lv: "Lietuva", lt: "Lietuva", et: "Leedu", ru: "Литва" },
      slug: "lithuania",
      type: "COUNTRY",
      children: [
        { name: { en: "Vilnius", lv: "Viļņa", lt: "Vilnius", et: "Vilnius", ru: "Вильнюс" }, slug: "vilnius", type: "CITY" },
        { name: { en: "Kaunas", lv: "Kauņa", lt: "Kaunas", et: "Kaunas", ru: "Каунас" }, slug: "kaunas", type: "CITY" },
        { name: { en: "Klaipėda", lv: "Klaipēda", lt: "Klaipėda", et: "Klaipėda", ru: "Клайпеда" }, slug: "klaipeda", type: "CITY" },
        { name: { en: "Šiauliai", lv: "Šauļi", lt: "Šiauliai", et: "Šiauliai", ru: "Шяуляй" }, slug: "siauliai", type: "CITY" },
        { name: { en: "Panevėžys", lv: "Panevēža", lt: "Panevėžys", et: "Panevėžys", ru: "Паневежис" }, slug: "panevezys", type: "CITY" },
        { name: { en: "Alytus", lv: "Aļitus", lt: "Alytus", et: "Alytus", ru: "Алитус" }, slug: "alytus", type: "CITY" },
        { name: { en: "Marijampolė", lv: "Marijampole", lt: "Marijampolė", et: "Marijampolė", ru: "Мариямполе" }, slug: "marijampole", type: "CITY" },
        { name: { en: "Utena", lv: "Utena", lt: "Utena", et: "Utena", ru: "Утена" }, slug: "utena", type: "CITY" },
        { name: { en: "Telšiai", lv: "Telši", lt: "Telšiai", et: "Telšiai", ru: "Тельшяй" }, slug: "telsiai", type: "CITY" },
        { name: { en: "Tauragė", lv: "Taurage", lt: "Tauragė", et: "Tauragė", ru: "Таураге" }, slug: "taurage", type: "CITY" },
      ],
    },
    {
      name: { en: "Estonia", lv: "Igaunija", lt: "Estija", et: "Eesti", ru: "Эстония" },
      slug: "estonia",
      type: "COUNTRY",
      children: [
        { name: { en: "Tallinn", lv: "Tallina", lt: "Talinas", et: "Tallinn", ru: "Таллинн" }, slug: "tallinn", type: "CITY" },
        { name: { en: "Tartu", lv: "Tartu", lt: "Tartu", et: "Tartu", ru: "Тарту" }, slug: "tartu", type: "CITY" },
        { name: { en: "Narva", lv: "Narva", lt: "Narva", et: "Narva", ru: "Нарва" }, slug: "narva", type: "CITY" },
        { name: { en: "Pärnu", lv: "Pērnava", lt: "Piarnū", et: "Pärnu", ru: "Пярну" }, slug: "parnu", type: "CITY" },
        { name: { en: "Kohtla-Järve", lv: "Kohtla-Jerve", lt: "Kohtla-Järve", et: "Kohtla-Järve", ru: "Кохтла-Ярве" }, slug: "kohtla-jarve", type: "CITY" },
        { name: { en: "Viljandi", lv: "Viljandi", lt: "Viljandis", et: "Viljandi", ru: "Вильянди" }, slug: "viljandi", type: "CITY" },
        { name: { en: "Rakvere", lv: "Rakvere", lt: "Rakverė", et: "Rakvere", ru: "Раквере" }, slug: "rakvere", type: "CITY" },
        { name: { en: "Kuressaare", lv: "Kuressāre", lt: "Kuressarė", et: "Kuressaare", ru: "Курессааре" }, slug: "kuressaare", type: "CITY" },
        { name: { en: "Haapsalu", lv: "Hāpsalu", lt: "Haapsalu", et: "Haapsalu", ru: "Хаапсалу" }, slug: "haapsalu", type: "CITY" },
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

  // ──────────────────────────────────────────────
  // TEST USERS
  // ──────────────────────────────────────────────
  console.log("  → Test users");

  const testUsers = [
    { email: "janis@test.lv", name: "Jānis Bērziņš", phone: "+37120000001", locale: "lv" },
    { email: "anna@test.lv", name: "Anna Kalniņa", phone: "+37120000002", locale: "lv" },
    { email: "maris@test.lv", name: "Māris Ozoliņš", phone: "+37120000003", locale: "lv" },
    { email: "liga@test.lv", name: "Līga Liepiņa", phone: "+37120000004", locale: "lv" },
    { email: "andris@test.lv", name: "Andris Krūmiņš", phone: "+37120000005", locale: "lv" },
    { email: "jonas@test.lt", name: "Jonas Kazlauskas", phone: "+37060000001", locale: "lt" },
    { email: "giedre@test.lt", name: "Giedrė Jonaitienė", phone: "+37060000002", locale: "lt" },
    { email: "mart@test.ee", name: "Mart Tamm", phone: "+37250000001", locale: "et" },
    { email: "katrin@test.ee", name: "Katrin Saar", phone: "+37250000002", locale: "et" },
    { email: "dmitrij@test.lv", name: "Дмитрий Иванов", phone: "+37120000006", locale: "ru" },
  ];

  const userRecords: Record<string, { id: string }> = {};
  for (const u of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, phone: u.phone, locale: u.locale },
      create: {
        email: u.email,
        name: u.name,
        phone: u.phone,
        locale: u.locale,
        emailVerified: new Date(),
        gdprConsentAt: new Date(),
      },
    });
    userRecords[u.email] = user;
  }

  // ──────────────────────────────────────────────
  // HELPER: look up category & location by slug
  // ──────────────────────────────────────────────
  async function getCat(slug: string) {
    return prisma.category.findUniqueOrThrow({ where: { slug } });
  }
  async function getLoc(slug: string) {
    return prisma.location.findUniqueOrThrow({ where: { slug } });
  }

  // ──────────────────────────────────────────────
  // TEST LISTINGS  (ss.lv-inspired data)
  // ──────────────────────────────────────────────
  console.log("  → Test listings");

  // --- Cars ---
  const carsCatRec = await getCat("cars");
  const rigaLoc = await getLoc("riga");
  const jurmalaLoc = await getLoc("jurmala");
  const liepaja = await getLoc("liepaja");
  const vilniusLoc = await getLoc("vilnius");
  const tallinnLoc = await getLoc("tallinn");
  const jelgavaLoc = await getLoc("jelgava");
  const daugavpilsLoc = await getLoc("daugavpils");
  const kaunasLoc = await getLoc("kaunas");
  const tartuLoc = await getLoc("tartu");
  const marupeLoc = await getLoc("marupe");

  const carListings = [
    {
      title: "BMW 520d xDrive, 2019, 87 000 km",
      slug: "bmw-520d-xdrive-2019",
      description: "BMW 520d xDrive Luxury Line. Automātiskā ārumsārba, ādas salons, navigācija, LED lukturi, apkurināmi sēdekļi, atpakaļskata kamera. Pilna servisa vēsture pie oficiālā dīlera. Viens īpašnieks. Tehniskā apskate līdz 2027. gadam.",
      price: 32500,
      condition: "USED" as const,
      userId: userRecords["janis@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37120000001",
      attrs: { Brand: "BMW", Year: "2019", "Mileage (km)": "87000", "Engine (L)": "2.0", "Fuel Type": "Diesel", Transmission: "Automatic", "Body Type": "Sedan", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      ],
    },
    {
      title: "Volkswagen Golf 8, 2021, 42 000 km",
      slug: "vw-golf-8-2021",
      description: "VW Golf 8 Style 1.5 TSI. Digitālā mērinstrumentu panelis, adaptīvais kruīza kontrole, Lane Assist, Park Assist, LED Matrix lukturi. Gaišs salons, lieliski uzturēts. Nopērkams arī līzingā.",
      price: 24900,
      condition: "USED" as const,
      userId: userRecords["maris@test.lv"].id,
      locationId: jurmalaLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37120000003",
      attrs: { Brand: "Volkswagen", Year: "2021", "Mileage (km)": "42000", "Engine (L)": "1.5", "Fuel Type": "Petrol", Transmission: "Automatic", "Body Type": "Hatchback", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800",
      ],
    },
    {
      title: "Audi A4 Avant 2.0 TDI, 2017, 134 000 km",
      slug: "audi-a4-avant-2017",
      description: "Audi A4 Avant S-line pakotne. Virtuālais kokpits, MMI navigācija, B&O skaņas sistēma, panorāmas jumts, elektriskais aizmugurējais vāks. Serviss pie Moller Auto. Ziemas riepas komplektā.",
      price: 19800,
      condition: "USED" as const,
      userId: userRecords["andris@test.lv"].id,
      locationId: jelgavaLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37120000005",
      attrs: { Brand: "Audi", Year: "2017", "Mileage (km)": "134000", "Engine (L)": "2.0", "Fuel Type": "Diesel", Transmission: "Automatic", "Body Type": "Wagon", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800",
      ],
    },
    {
      title: "Toyota RAV4 Hybrid, 2022, 28 000 km",
      slug: "toyota-rav4-hybrid-2022",
      description: "Toyota RAV4 2.5 Hybrid AWD. Pilna komplektācija, ādas salons, JBL skaňas sistēma, panorāma jumts, apkurināmi sēdekļi un stūre. Garantija līdz 2027. gadam. Viens īpašnieks.",
      price: 38500,
      condition: "USED" as const,
      userId: userRecords["jonas@test.lt"].id,
      locationId: vilniusLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37060000001",
      attrs: { Brand: "Toyota", Year: "2022", "Mileage (km)": "28000", "Engine (L)": "2.5", "Fuel Type": "Hybrid", Transmission: "Automatic", "Body Type": "SUV", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
      ],
    },
    {
      title: "Opel Astra 1.6 CDTI, 2016, 168 000 km",
      slug: "opel-astra-2016",
      description: "Opel Astra K 1.6 CDTI 110 ZS. Ekonomisks dīzelis, kruīza kontrole, multifunkcionālā stūre, Bluetooth, kondicionieris. Labs stāvoklis, regulāri apkopota. Cena nedaudz runājama.",
      price: 8900,
      condition: "USED" as const,
      userId: userRecords["dmitrij@test.lv"].id,
      locationId: daugavpilsLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37120000006",
      attrs: { Brand: "Opel", Year: "2016", "Mileage (km)": "168000", "Engine (L)": "1.6", "Fuel Type": "Diesel", Transmission: "Manual", "Body Type": "Hatchback", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
      ],
    },
    {
      title: "Mercedes-Benz C220d AMG, 2020, 65 000 km",
      slug: "mercedes-c220d-amg-2020",
      description: "Mercedes-Benz C220d 4MATIC, AMG pakett, kõigi rataste vedamine. Nahksisu, MBUX multimeedia, 360° kaamera, ambient-valgustus, Burmester helikaart. Hooldatud ametlikus teeninduses.",
      price: 35900,
      condition: "USED" as const,
      userId: userRecords["mart@test.ee"].id,
      locationId: tallinnLoc.id,
      categoryId: carsCatRec.id,
      contactPhone: "+37250000001",
      attrs: { Brand: "Mercedes-Benz", Year: "2020", "Mileage (km)": "65000", "Engine (L)": "2.0", "Fuel Type": "Diesel", Transmission: "Automatic", "Body Type": "Sedan", "Technical Inspection": "true" },
      images: [
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800",
      ],
    },
  ];

  // --- Apartments ---
  const aptSaleCatRec = await getCat("apartments-sale");
  const aptRentCatRec = await getCat("apartments-rent");

  const aptListings = [
    {
      title: "3-istabu dzīvoklis Centrā, 78 m²",
      slug: "3-ist-dzivoklis-centra-78m2",
      description: "Pārdod pilnīgi renovētu 3-istabu dzīvokli Rīgas centrā, Quiet centrā. Kvalitatīvs remonts 2023. gadā: jauna virtuve, vannas istaba, parkets. Liels balkons ar skatu uz pilsētu. Iebūvēta virtuve ar Bosch tehniku. Apkurināmas grīdas vannas istabā.",
      price: 185000,
      condition: "USED" as const,
      userId: userRecords["anna@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: aptSaleCatRec.id,
      contactPhone: "+37120000002",
      images: [
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      ],
    },
    {
      title: "2-istabu dzīvoklis jaunajā projektā, Mārupē, 56 m²",
      slug: "2-ist-jaunais-projekts-marupe-56m2",
      description: "Pārdod 2-istabu dzīvokli jaunajā projektā 'Mārupe Gardens'. Augsta kvalitāte: trīskāršie stikli, silts modulis, A enerģijas klase. Autostāvvieta pazemes garāžā iekļauta cenā. Pieejams no 2026. gada marta.",
      price: 142000,
      condition: "NEW" as const,
      userId: userRecords["liga@test.lv"].id,
      locationId: marupeLoc.id,
      categoryId: aptSaleCatRec.id,
      contactPhone: "+37120000004",
      images: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      ],
    },
    {
      title: "1-kambario butas Vilniaus senamiestyje, 38 m²",
      slug: "1-kamb-butas-vilnius-senamiestis-38m2",
      description: "Parduodamas jaukus 1 kambario butas Vilniaus senamiestyje. Visiškai suremontuotas, baldai įskaičiuoti į kainą. Šildymas dujomis, žemi komunaliniai mokesčiai. Rajonas ramus, šalia visa infrastruktūra. Puiki investicija nuomai.",
      price: 115000,
      condition: "USED" as const,
      userId: userRecords["jonas@test.lt"].id,
      locationId: vilniusLoc.id,
      categoryId: aptSaleCatRec.id,
      contactPhone: "+37060000001",
      images: [
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
      ],
    },
    {
      title: "2-toaline korter Tallinna kesklinnas, 52 m²",
      slug: "2-toaline-korter-tallinn-kesklinn-52m2",
      description: "Müüa renoveeritud 2-toaline korter Tallinna kesklinnas. Uus köök, vannituba, parkett. Rõdu linnavaatega. Soe korter, head ühistranspordi ühendused. Parkimiskoht hoovis.",
      price: 195000,
      condition: "USED" as const,
      userId: userRecords["katrin@test.ee"].id,
      locationId: tallinnLoc.id,
      categoryId: aptSaleCatRec.id,
      contactPhone: "+37250000002",
      images: [
        "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
      ],
    },
    {
      title: "Izīrē 2-istabu dzīvokli Āgenskalnā, 54 m²",
      slug: "izire-2-ist-agenskalns-54m2",
      description: "Izīrē mēbelētu 2-istabu dzīvokli klusā Āgenskalna ielā. Remonts 2024. gadā, pilnībā mēbelēts, veļasmašīna, trauku mazgājamā mašīna. Komunālie ~120 EUR/mēn. Pieejams no marta.",
      price: 550,
      condition: "USED" as const,
      userId: userRecords["maris@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: aptRentCatRec.id,
      contactPhone: "+37120000003",
      images: [
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
      ],
    },
  ];

  // --- Electronics ---
  const phonesCatRec = await getCat("phones-tablets");
  const laptopsCatRec = await getCat("laptops");
  const gamingCatRec = await getCat("gaming");

  const electronicsListings = [
    {
      title: "iPhone 15 Pro Max 256GB Natural Titanium",
      slug: "iphone-15-pro-max-256gb",
      description: "Pārdodu iPhone 15 Pro Max 256GB Natural Titanium. Lietots 6 mēnešus, perfektā stāvoklī, bez skrāpējumiem. Komplektā: oriģinālā kaste, kabelis, aizsargstikls jau uzlikts. Akumulatora veselība 98%. Garantija līdz 2027. gadam.",
      price: 950,
      condition: "USED" as const,
      userId: userRecords["anna@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: phonesCatRec.id,
      contactPhone: "+37120000002",
      images: [
        "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
      ],
    },
    {
      title: "Samsung Galaxy S24 Ultra 512GB",
      slug: "samsung-s24-ultra-512gb",
      description: "Samsung Galaxy S24 Ultra, 512GB, Titanium Gray. Naudotas 3 mėnesius, idealios būklės. S Pen, originali dėžutė ir pakrovėjas. Galaxy AI funkcijos. Ekrano apsauga ir dėklas pridedami nemokamai.",
      price: 1050,
      condition: "USED" as const,
      userId: userRecords["giedre@test.lt"].id,
      locationId: kaunasLoc.id,
      categoryId: phonesCatRec.id,
      contactPhone: "+37060000002",
      images: [
        "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800",
      ],
    },
    {
      title: "MacBook Pro 14\" M3 Pro 18GB/512GB",
      slug: "macbook-pro-14-m3-pro",
      description: "Apple MacBook Pro 14 collas ar M3 Pro čipu, 18GB RAM, 512GB SSD. Space Black krāsa. Pirkts 2024. gada oktobrī Apple veikalā. Akumulatora ciklu skaits: 45. Perfekts stāvoklis, komplektā lādētājs un kaste.",
      price: 1750,
      condition: "USED" as const,
      userId: userRecords["janis@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: laptopsCatRec.id,
      contactPhone: "+37120000001",
      images: [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
      ],
    },
    {
      title: "Lenovo ThinkPad X1 Carbon Gen 11, i7, 32GB",
      slug: "thinkpad-x1-carbon-gen11",
      description: "Lenovo ThinkPad X1 Carbon Gen 11. Intel Core i7-1365U, 32GB RAM, 1TB SSD, 14\" 2.8K OLED ekrāns. Izcils biznesa klases portatīvais dators. Ideāls attālinātam darbam. Komplektā docking station.",
      price: 1200,
      condition: "USED" as const,
      userId: userRecords["mart@test.ee"].id,
      locationId: tartuLoc.id,
      categoryId: laptopsCatRec.id,
      contactPhone: "+37250000001",
      images: [
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
      ],
    },
    {
      title: "PlayStation 5 + 2 kontrolieri + 5 spēles",
      slug: "ps5-bundle-controllers-games",
      description: "Pārdodu PlayStation 5 Disc Edition komplektu. Iekļauts: 2x DualSense kontrolieri (balts + melns), 5 spēles (Spider-Man 2, God of War Ragnarök, Horizon Forbidden West, Gran Turismo 7, FC 25). Viss labā stāvoklī. Čeks pieejams.",
      price: 420,
      condition: "USED" as const,
      userId: userRecords["andris@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: gamingCatRec.id,
      contactPhone: "+37120000005",
      images: [
        "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800",
      ],
    },
  ];

  // --- Home & Garden ---
  const furnitureCatRec = await getCat("furniture");
  const appliancesCatRec = await getCat("appliances");
  const toolsCatRec = await getCat("tools");

  const homeListings = [
    {
      title: "IKEA stūra dīvāns SÖDERHAMN, pelēks",
      slug: "ikea-soderhamn-stūra-divans",
      description: "Pārdodu IKEA SÖDERHAMN stūra dīvānu, 3+1. Pelēka Samsta krāsa. Iegādāts 2023. gadā, ļoti labs stāvoklis. Noņemami un mazgājami pārvalki. Ir arī papildu atzveltņu komplekts. Jāizved pašam. Centra+ rajons.",
      price: 650,
      condition: "USED" as const,
      userId: userRecords["liga@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: furnitureCatRec.id,
      contactPhone: "+37120000004",
      images: [
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
      ],
    },
    {
      title: "Bosch veļasmašīna Serie 6, 9kg, A+++",
      slug: "bosch-velasmasina-serie6-9kg",
      description: "Bosch WAU28P40 veļasmašīna, 9kg ietilpība, 1400 apgr/min. A+++ energoklase, ļoti klusa darbība. Anti-vibration dizains. Lietota 2 gadus, darbojas nevainojami. Pārdodu sakarā ar pārcelšanos.",
      price: 350,
      condition: "USED" as const,
      userId: userRecords["anna@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: appliancesCatRec.id,
      contactPhone: "+37120000002",
      images: [
        "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800",
      ],
    },
    {
      title: "Makita akumulatora urbis-skrūvgriezis DDF484",
      slug: "makita-akumulatora-urbis-ddf484",
      description: "Makita DDF484RTJ 18V LXT akumulatora urbis-skrūvgriezis. Komplektā 2x 5.0Ah akumulatori, lādētājs, MAKPAC koferis. Bezotas motors, 54Nm griezes moments. Mazlietots, kā jauns.",
      price: 185,
      condition: "USED" as const,
      userId: userRecords["andris@test.lv"].id,
      locationId: jelgavaLoc.id,
      categoryId: toolsCatRec.id,
      contactPhone: "+37120000005",
      images: [
        "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
      ],
    },
  ];

  // --- Sports & Outdoors ---
  const gymCatRec = await getCat("gym-equipment");
  const bicyclesCatRec = await getCat("bicycles");

  const sportsListings = [
    {
      title: "Trenažieru sols ar stieni un svaru komplektu",
      slug: "trenaziera-sols-svari",
      description: "Pārdodu mājas trenažieru komplektu: regulējams sols, olimpiskais stienis 20kg, svaru diski (2x20kg, 2x10kg, 2x5kg, 4x2.5kg). Kopā 95kg svaru. Lieliski piemērots mājas treniňiem. Var apskatīt Jūrmalā.",
      price: 280,
      condition: "USED" as const,
      userId: userRecords["janis@test.lv"].id,
      locationId: jurmalaLoc.id,
      categoryId: gymCatRec.id,
      contactPhone: "+37120000001",
      images: [
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
      ],
    },
    {
      title: "Cube Reaction Hybrid Pro 625, 2024, L",
      slug: "cube-reaction-hybrid-pro-625-2024",
      description: "Pārdodu e-velosipēdu Cube Reaction Hybrid Pro 625 Wh, 2024. gada modelis, L izmērs. Bosch Performance CX motors. Nobraukums ~800 km. Shimano Deore XT pārslēgi. Ideāls pilsētas un meža braucieniem.",
      price: 2800,
      condition: "USED" as const,
      userId: userRecords["mart@test.ee"].id,
      locationId: tallinnLoc.id,
      categoryId: bicyclesCatRec.id,
      contactPhone: "+37250000001",
      images: [
        "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800",
      ],
    },
  ];

  // --- Fashion ---
  const womensCatRec = await getCat("womens-clothing");
  const shoesCatRec = await getCat("shoes");

  const fashionListings = [
    {
      title: "Max Mara vilnas mētelis, M, kamelkrāsa",
      slug: "max-mara-vilnas-metelis-m",
      description: "Max Mara 101801 ikona mētelis, 100% kamieļvilna. Izmērs M (IT 42). Kamelkrāsa. Nēsāts vienu sezonu, perfekts stāvoklis. Oriģinālā cena €1,800. Iekļauts apģērbu maisiņš.",
      price: 750,
      condition: "USED" as const,
      userId: userRecords["liga@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: womensCatRec.id,
      contactPhone: "+37120000004",
      images: [
        "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800",
      ],
    },
    {
      title: "Nike Air Max 90, vīriešu 43. izmērs, jauni",
      slug: "nike-air-max-90-43-jauni",
      description: "Jauni Nike Air Max 90 Essential, White/Black colorway. Izmērs EUR 43 (US 9.5). Oriģināli, pasūtīti no Nike.com, izrādījās par mazu. Kaste un čeks iekļauti. Cena nav runājama.",
      price: 95,
      condition: "NEW" as const,
      userId: userRecords["maris@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: shoesCatRec.id,
      contactPhone: "+37120000003",
      negotiable: false,
      images: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
      ],
    },
  ];

  // --- Pets ---
  const dogsCatRec = await getCat("dogs");

  const petListings = [
    {
      title: "Labradoru retrīveru kucēni, ar ciltsrakstiem",
      slug: "labradoru-retreiveru-kuceni",
      description: "Piedāvājam brīnišķīgus Labradoru retrīveru kucēnus. Dzimšanas datums: 2026. gada 5. janvāris. Šokoladkrāsas un melnā krāsā. Čipēti, vakcinēti, ar ciltsrakstiem (LKF). Vecāki pārbaudīti uz pārmantotajām slimībām. Gatavi jaunajām mājām no 8 marta.",
      price: 1200,
      condition: "NEW" as const,
      userId: userRecords["giedre@test.lt"].id,
      locationId: kaunasLoc.id,
      categoryId: dogsCatRec.id,
      contactPhone: "+37060000002",
      images: [
        "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=800",
      ],
    },
  ];

  // --- Hobbies ---
  const musicCatRec = await getCat("music-instruments");

  const hobbyListings = [
    {
      title: "Yamaha C40 klasiskā ģitāra + soma",
      slug: "yamaha-c40-klasiska-gitara",
      description: "Yamaha C40 klasiskā ģitāra, ideāla iesācējiem un vidējā līmeňa spēlētājiem. Ļoti labs skanējums, stīgas nomainītas pirms mēneša. Komplektā mīkstā soma un tūneris. Viss ieliokts stāvoklī.",
      price: 85,
      condition: "USED" as const,
      userId: userRecords["dmitrij@test.lv"].id,
      locationId: rigaLoc.id,
      categoryId: musicCatRec.id,
      contactPhone: "+37120000006",
      images: [
        "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800",
      ],
    },
  ];

  // --- Real Estate (houses) ---
  const housesSaleCatRec = await getCat("houses-sale");

  const houseListings = [
    {
      title: "Privātmāja Jūrmalā, Dzintaros, 220 m²",
      slug: "privatmaja-jurmala-dzintari-220m2",
      description: "Pārdod modernu privātmāju Jūrmalā, Dzintaros, 500m no jūras. 220 m² dzīvošanas platība, 3 stāvi, 5 istabas, 2 vannas istabas, sauna, garāža 2 auto. Zemes gabals 1200 m². Pilnībā renovēta 2022. gadā. Gāzes apkure, silts māja – zemi komunālie.",
      price: 420000,
      condition: "USED" as const,
      userId: userRecords["anna@test.lv"].id,
      locationId: jurmalaLoc.id,
      categoryId: housesSaleCatRec.id,
      contactPhone: "+37120000002",
      images: [
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      ],
    },
  ];

  // --- Agriculture ---
  const farmEquipCatRec = await getCat("farm-equipment");

  const agriListings = [
    {
      title: "John Deere 6130R traktors, 2018, 3200 motostundas",
      slug: "john-deere-6130r-2018",
      description: "John Deere 6130R, 130 ZS, 2018. gads, 3200 motostundas. AutoQuad Plus transmisija, priekšas iekrāvējs 623R, klimata kontrole, GPS sagatavots. Regulāri apkopots pie oficiālā dīlera. Var apskatīt Jelgavas novadā.",
      price: 72000,
      condition: "USED" as const,
      userId: userRecords["andris@test.lv"].id,
      locationId: jelgavaLoc.id,
      categoryId: farmEquipCatRec.id,
      contactPhone: "+37120000005",
      images: [
        "https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=800",
      ],
    },
  ];

  // ──────────────────────────────────────────────
  // UPSERT ALL LISTINGS
  // ──────────────────────────────────────────────
  const allListings = [
    ...carListings,
    ...aptListings,
    ...electronicsListings,
    ...homeListings,
    ...sportsListings,
    ...fashionListings,
    ...petListings,
    ...hobbyListings,
    ...houseListings,
    ...agriListings,
  ];

  for (const l of allListings) {
    const listing = await prisma.listing.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        description: l.description,
        price: l.price,
        condition: l.condition,
        userId: l.userId,
        locationId: l.locationId,
        categoryId: l.categoryId,
        contactPhone: l.contactPhone ?? null,
        negotiable: (l as any).negotiable ?? true,
        status: "ACTIVE",
      },
      create: {
        title: l.title,
        slug: l.slug,
        description: l.description,
        price: l.price,
        condition: l.condition,
        status: "ACTIVE",
        userId: l.userId,
        locationId: l.locationId,
        categoryId: l.categoryId,
        contactPhone: l.contactPhone ?? null,
        negotiable: (l as any).negotiable ?? true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Upsert images
    if (l.images) {
      // Delete existing images for this listing first
      await prisma.listingImage.deleteMany({ where: { listingId: listing.id } });
      for (let idx = 0; idx < l.images.length; idx++) {
        await prisma.listingImage.create({
          data: {
            listingId: listing.id,
            url: l.images[idx],
            thumbnailUrl: l.images[idx].replace("w=800", "w=200"),
            alt: l.title,
            sortOrder: idx,
            isPrimary: idx === 0,
          },
        });
      }
    }

    // Upsert car attributes if present
    if ((l as any).attrs && l.categoryId === carsCatRec.id) {
      const attrs = (l as any).attrs as Record<string, string>;
      const catAttrs = await prisma.categoryAttribute.findMany({
        where: { categoryId: carsCatRec.id },
      });
      // Delete existing listing attributes
      await prisma.listingAttribute.deleteMany({ where: { listingId: listing.id } });
      for (const catAttr of catAttrs) {
        const nameObj = catAttr.name as Record<string, string>;
        const key = nameObj.en;
        if (key && attrs[key]) {
          await prisma.listingAttribute.create({
            data: {
              listingId: listing.id,
              categoryAttributeId: catAttr.id,
              value: attrs[key],
            },
          });
        }
      }
    }
  }

  console.log(`  → Created ${allListings.length} test listings`);
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
