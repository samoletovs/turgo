import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { ListingCard } from "@/components/listing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { getLocalizedName } from "@/lib/utils";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { APP_URL } from "@/lib/constants";

/* ── Fallback category catalogue (matches seed data) ── */
const FALLBACK_CATEGORIES: {
  name: Record<string, string>;
  slug: string;
  children: { name: Record<string, string>; slug: string }[];
}[] = [
  {
    name: {
      en: "Transport",
      lv: "Transports",
      lt: "Transportas",
      et: "Transport",
      ru: "Транспорт",
    },
    slug: "transport",
    children: [
      {
        name: {
          en: "Cars",
          lv: "Automašīnas",
          lt: "Automobiliai",
          et: "Autod",
          ru: "Автомобили",
        },
        slug: "cars",
      },
      {
        name: {
          en: "Motorcycles",
          lv: "Motocikli",
          lt: "Motociklai",
          et: "Mootorrattad",
          ru: "Мотоциклы",
        },
        slug: "motorcycles",
      },
      {
        name: {
          en: "Trucks & Buses",
          lv: "Kravas auto un autobusi",
          lt: "Sunkvežimiai ir autobusai",
          et: "Veoautod ja bussid",
          ru: "Грузовики и автобусы",
        },
        slug: "trucks-buses",
      },
      {
        name: {
          en: "Spare Parts",
          lv: "Rezerves daļas",
          lt: "Atsarginės dalys",
          et: "Varuosad",
          ru: "Запчасти",
        },
        slug: "spare-parts",
      },
      {
        name: {
          en: "Tires & Wheels",
          lv: "Riepas un diski",
          lt: "Padangos ir ratlankiai",
          et: "Rehvid ja veljed",
          ru: "Шины и диски",
        },
        slug: "tires-wheels",
      },
      {
        name: {
          en: "Boats",
          lv: "Laivas",
          lt: "Laivai",
          et: "Paadid",
          ru: "Лодки",
        },
        slug: "boats",
      },
      {
        name: {
          en: "Bicycles",
          lv: "Velosipēdi",
          lt: "Dviračiai",
          et: "Jalgrattad",
          ru: "Велосипеды",
        },
        slug: "bicycles",
      },
      {
        name: {
          en: "Other Transport",
          lv: "Cits transports",
          lt: "Kitas transportas",
          et: "Muu transport",
          ru: "Другой транспорт",
        },
        slug: "other-transport",
      },
    ],
  },
  {
    name: {
      en: "Real Estate",
      lv: "Nekustamais īpašums",
      lt: "Nekilnojamasis turtas",
      et: "Kinnisvara",
      ru: "Недвижимость",
    },
    slug: "real-estate",
    children: [
      {
        name: {
          en: "Apartments - Sale",
          lv: "Dzīvokļi - Pārdod",
          lt: "Butai - Parduoda",
          et: "Korterid - Müük",
          ru: "Квартиры - Продажа",
        },
        slug: "apartments-sale",
      },
      {
        name: {
          en: "Apartments - Rent",
          lv: "Dzīvokļi - Īrē",
          lt: "Butai - Nuoma",
          et: "Korterid - Üür",
          ru: "Квартиры - Аренда",
        },
        slug: "apartments-rent",
      },
      {
        name: {
          en: "Houses - Sale",
          lv: "Mājas - Pārdod",
          lt: "Namai - Parduoda",
          et: "Majad - Müük",
          ru: "Дома - Продажа",
        },
        slug: "houses-sale",
      },
      {
        name: {
          en: "Houses - Rent",
          lv: "Mājas - Īrē",
          lt: "Namai - Nuoma",
          et: "Majad - Üür",
          ru: "Дома - Аренда",
        },
        slug: "houses-rent",
      },
      {
        name: { en: "Land", lv: "Zeme", lt: "Žemė", et: "Maa", ru: "Земля" },
        slug: "land",
      },
      {
        name: {
          en: "Commercial",
          lv: "Komercīpašumi",
          lt: "Komercinis",
          et: "Äripinnad",
          ru: "Коммерческая",
        },
        slug: "commercial-property",
      },
      {
        name: {
          en: "Garages",
          lv: "Garāžas",
          lt: "Garažai",
          et: "Garaažid",
          ru: "Гаражи",
        },
        slug: "garages",
      },
    ],
  },
  {
    name: {
      en: "Electronics",
      lv: "Elektronika",
      lt: "Elektronika",
      et: "Elektroonika",
      ru: "Электроника",
    },
    slug: "electronics",
    children: [
      {
        name: {
          en: "Phones & Tablets",
          lv: "Telefoni un planšetes",
          lt: "Telefonai ir planšetės",
          et: "Telefonid ja tahvlid",
          ru: "Телефоны и планшеты",
        },
        slug: "phones-tablets",
      },
      {
        name: {
          en: "Computers",
          lv: "Datori",
          lt: "Kompiuteriai",
          et: "Arvutid",
          ru: "Компьютеры",
        },
        slug: "computers",
      },
      {
        name: {
          en: "Laptops",
          lv: "Portatīvie datori",
          lt: "Nešiojami kompiuteriai",
          et: "Sülearvutid",
          ru: "Ноутбуки",
        },
        slug: "laptops",
      },
      {
        name: {
          en: "TVs & Audio",
          lv: "TV un audio",
          lt: "TV ir garso technika",
          et: "TV ja heli",
          ru: "ТВ и аудио",
        },
        slug: "tvs-audio",
      },
      {
        name: {
          en: "Gaming",
          lv: "Spēles",
          lt: "Žaidimai",
          et: "Mängud",
          ru: "Игры",
        },
        slug: "gaming",
      },
      {
        name: {
          en: "Cameras",
          lv: "Kameras",
          lt: "Kameros",
          et: "Kaamerad",
          ru: "Камеры",
        },
        slug: "cameras",
      },
      {
        name: {
          en: "Accessories",
          lv: "Piederumi",
          lt: "Priedai",
          et: "Tarvikud",
          ru: "Аксессуары",
        },
        slug: "electronics-accessories",
      },
    ],
  },
  {
    name: {
      en: "Home & Garden",
      lv: "Māja un dārzs",
      lt: "Namai ir sodas",
      et: "Kodu ja aed",
      ru: "Дом и сад",
    },
    slug: "home-garden",
    children: [
      {
        name: {
          en: "Furniture",
          lv: "Mēbeles",
          lt: "Baldai",
          et: "Mööbel",
          ru: "Мебель",
        },
        slug: "furniture",
      },
      {
        name: {
          en: "Appliances",
          lv: "Sadzīves tehnika",
          lt: "Buitinė technika",
          et: "Kodumasinad",
          ru: "Бытовая техника",
        },
        slug: "appliances",
      },
      {
        name: {
          en: "Tools",
          lv: "Instrumenti",
          lt: "Įrankiai",
          et: "Tööriistad",
          ru: "Инструменты",
        },
        slug: "tools",
      },
      {
        name: { en: "Garden", lv: "Dārzs", lt: "Sodas", et: "Aed", ru: "Сад" },
        slug: "garden",
      },
      {
        name: {
          en: "Renovation",
          lv: "Remonts",
          lt: "Remontas",
          et: "Remont",
          ru: "Ремонт",
        },
        slug: "renovation",
      },
      {
        name: {
          en: "Decor",
          lv: "Dekors",
          lt: "Dekoras",
          et: "Dekoratsioonid",
          ru: "Декор",
        },
        slug: "decor",
      },
    ],
  },
  {
    name: { en: "Fashion", lv: "Mode", lt: "Mada", et: "Mood", ru: "Мода" },
    slug: "fashion",
    children: [
      {
        name: {
          en: "Women's Clothing",
          lv: "Sieviešu apģērbs",
          lt: "Moteriški drabužiai",
          et: "Naiste riided",
          ru: "Женская одежда",
        },
        slug: "womens-clothing",
      },
      {
        name: {
          en: "Men's Clothing",
          lv: "Vīriešu apģērbs",
          lt: "Vyriški drabužiai",
          et: "Meeste riided",
          ru: "Мужская одежда",
        },
        slug: "mens-clothing",
      },
      {
        name: {
          en: "Children's Clothing",
          lv: "Bērnu apģērbs",
          lt: "Vaikiški drabužiai",
          et: "Laste riided",
          ru: "Детская одежда",
        },
        slug: "childrens-clothing",
      },
      {
        name: {
          en: "Shoes",
          lv: "Apavi",
          lt: "Batai",
          et: "Jalanõud",
          ru: "Обувь",
        },
        slug: "shoes",
      },
      {
        name: {
          en: "Bags & Accessories",
          lv: "Somas un aksesuāri",
          lt: "Krepšiai ir aksesuarai",
          et: "Kotid ja aksessuaarid",
          ru: "Сумки и аксессуары",
        },
        slug: "bags-accessories",
      },
      {
        name: {
          en: "Watches & Jewelry",
          lv: "Pulksteņi un rotaslietas",
          lt: "Laikrodžiai ir papuošalai",
          et: "Kellad ja ehted",
          ru: "Часы и украшения",
        },
        slug: "watches-jewelry",
      },
    ],
  },
  {
    name: { en: "Jobs", lv: "Darbs", lt: "Darbas", et: "Töö", ru: "Работа" },
    slug: "jobs",
    children: [
      {
        name: {
          en: "IT & Telecom",
          lv: "IT un telekomunikācijas",
          lt: "IT ir telekomunikacijos",
          et: "IT ja telekommunikatsioon",
          ru: "IT и телеком",
        },
        slug: "it-telecom",
      },
      {
        name: {
          en: "Finance & Accounting",
          lv: "Finanses un grāmatvedība",
          lt: "Finansai ir apskaita",
          et: "Rahandus ja raamatupidamine",
          ru: "Финансы и бухгалтерия",
        },
        slug: "finance-accounting",
      },
      {
        name: {
          en: "Sales & Marketing",
          lv: "Pārdošana un mārketings",
          lt: "Pardavimai ir rinkodara",
          et: "Müük ja turundus",
          ru: "Продажи и маркетинг",
        },
        slug: "sales-marketing",
      },
      {
        name: {
          en: "Construction",
          lv: "Būvniecība",
          lt: "Statyba",
          et: "Ehitus",
          ru: "Строительство",
        },
        slug: "construction-jobs",
      },
      {
        name: {
          en: "Healthcare",
          lv: "Veselības aprūpe",
          lt: "Sveikatos priežiūra",
          et: "Tervishoid",
          ru: "Здравоохранение",
        },
        slug: "healthcare-jobs",
      },
      {
        name: {
          en: "Education",
          lv: "Izglītība",
          lt: "Švietimas",
          et: "Haridus",
          ru: "Образование",
        },
        slug: "education-jobs",
      },
      {
        name: {
          en: "Service Industry",
          lv: "Pakalpojumu nozare",
          lt: "Paslaugų sektorius",
          et: "Teenindus",
          ru: "Сфера услуг",
        },
        slug: "service-industry",
      },
      {
        name: {
          en: "Other Jobs",
          lv: "Citi darbi",
          lt: "Kiti darbai",
          et: "Muud tööd",
          ru: "Другая работа",
        },
        slug: "other-jobs",
      },
    ],
  },
  {
    name: {
      en: "Services",
      lv: "Pakalpojumi",
      lt: "Paslaugos",
      et: "Teenused",
      ru: "Услуги",
    },
    slug: "services",
    children: [
      {
        name: {
          en: "Construction & Repair",
          lv: "Būvniecība un remonts",
          lt: "Statyba ir remontas",
          et: "Ehitus ja remont",
          ru: "Строительство и ремонт",
        },
        slug: "construction-repair",
      },
      {
        name: {
          en: "Transportation",
          lv: "Transportēšana",
          lt: "Transportavimas",
          et: "Veoteenused",
          ru: "Перевозки",
        },
        slug: "transportation-services",
      },
      {
        name: {
          en: "Beauty & Health",
          lv: "Skaistums un veselība",
          lt: "Grožis ir sveikata",
          et: "Ilu ja tervis",
          ru: "Красота и здоровье",
        },
        slug: "beauty-health",
      },
      {
        name: {
          en: "Education & Tutoring",
          lv: "Izglītība un korepetīcijas",
          lt: "Švietimas ir korepetavimas",
          et: "Haridus ja koolitused",
          ru: "Образование и репетиторство",
        },
        slug: "education-tutoring",
      },
      {
        name: {
          en: "IT Services",
          lv: "IT pakalpojumi",
          lt: "IT paslaugos",
          et: "IT teenused",
          ru: "IT-услуги",
        },
        slug: "it-services",
      },
      {
        name: {
          en: "Other Services",
          lv: "Citi pakalpojumi",
          lt: "Kitos paslaugos",
          et: "Muud teenused",
          ru: "Другие услуги",
        },
        slug: "other-services",
      },
    ],
  },
  {
    name: {
      en: "Kids & Baby",
      lv: "Bērniem",
      lt: "Vaikams",
      et: "Lastele",
      ru: "Детям",
    },
    slug: "kids-baby",
    children: [
      {
        name: {
          en: "Strollers",
          lv: "Ratiņi",
          lt: "Vežimėliai",
          et: "Kärud",
          ru: "Коляски",
        },
        slug: "strollers",
      },
      {
        name: {
          en: "Toys",
          lv: "Rotaļlietas",
          lt: "Žaislai",
          et: "Mänguasjad",
          ru: "Игрушки",
        },
        slug: "toys",
      },
      {
        name: {
          en: "Baby Clothes",
          lv: "Bērnu apģērbs",
          lt: "Kūdikių drabužiai",
          et: "Beebi riided",
          ru: "Детская одежда",
        },
        slug: "baby-clothes",
      },
      {
        name: {
          en: "Furniture & Safety",
          lv: "Mēbeles un drošība",
          lt: "Baldai ir sauga",
          et: "Mööbel ja ohutus",
          ru: "Мебель и безопасность",
        },
        slug: "kids-furniture",
      },
      {
        name: {
          en: "School Supplies",
          lv: "Skolas piederumi",
          lt: "Mokyklinės prekės",
          et: "Koolitarbed",
          ru: "Школьные принадлежности",
        },
        slug: "school-supplies",
      },
    ],
  },
  {
    name: {
      en: "Sports & Outdoors",
      lv: "Sports un atpūta",
      lt: "Sportas ir laisvalaikis",
      et: "Sport ja vaba aeg",
      ru: "Спорт и отдых",
    },
    slug: "sports-outdoors",
    children: [
      {
        name: {
          en: "Gym Equipment",
          lv: "Trenažieri",
          lt: "Treniruokliai",
          et: "Treeningvarustus",
          ru: "Тренажёры",
        },
        slug: "gym-equipment",
      },
      {
        name: {
          en: "Winter Sports",
          lv: "Ziemas sports",
          lt: "Žiemos sportas",
          et: "Talvesport",
          ru: "Зимний спорт",
        },
        slug: "winter-sports",
      },
      {
        name: {
          en: "Water Sports",
          lv: "Ūdens sports",
          lt: "Vandens sportas",
          et: "Veesport",
          ru: "Водный спорт",
        },
        slug: "water-sports",
      },
      {
        name: {
          en: "Camping & Hiking",
          lv: "Kempings un pārgājieni",
          lt: "Stovyklavimas ir žygiai",
          et: "Matkamine",
          ru: "Кемпинг и походы",
        },
        slug: "camping-hiking",
      },
      {
        name: {
          en: "Team Sports",
          lv: "Komandu sports",
          lt: "Komandinės sporto šakos",
          et: "Võistkonnasport",
          ru: "Командный спорт",
        },
        slug: "team-sports",
      },
      {
        name: {
          en: "Fishing & Hunting",
          lv: "Makšķerēšana un medības",
          lt: "Žvejyba ir medžioklė",
          et: "Kalastamine ja jaht",
          ru: "Рыбалка и охота",
        },
        slug: "fishing-hunting",
      },
    ],
  },
  {
    name: {
      en: "Pets",
      lv: "Dzīvnieki",
      lt: "Gyvūnai",
      et: "Loomad",
      ru: "Животные",
    },
    slug: "pets",
    children: [
      {
        name: {
          en: "Dogs",
          lv: "Suņi",
          lt: "Šunys",
          et: "Koerad",
          ru: "Собаки",
        },
        slug: "dogs",
      },
      {
        name: {
          en: "Cats",
          lv: "Kaķi",
          lt: "Katės",
          et: "Kassid",
          ru: "Кошки",
        },
        slug: "cats",
      },
      {
        name: {
          en: "Birds",
          lv: "Putni",
          lt: "Paukščiai",
          et: "Linnud",
          ru: "Птицы",
        },
        slug: "birds",
      },
      {
        name: {
          en: "Fish & Aquariums",
          lv: "Zivis un akvāriji",
          lt: "Žuvys ir akvariumai",
          et: "Kalad ja akvaariumid",
          ru: "Рыбки и аквариумы",
        },
        slug: "fish-aquariums",
      },
      {
        name: {
          en: "Pet Supplies",
          lv: "Mājdzīvnieku preces",
          lt: "Prekės gyvūnams",
          et: "Loomakaubad",
          ru: "Зоотовары",
        },
        slug: "pet-supplies",
      },
      {
        name: {
          en: "Other Animals",
          lv: "Citi dzīvnieki",
          lt: "Kiti gyvūnai",
          et: "Muud loomad",
          ru: "Другие животные",
        },
        slug: "other-animals",
      },
    ],
  },
  {
    name: {
      en: "Hobbies & Leisure",
      lv: "Hobiji un brīvais laiks",
      lt: "Pomėgiai ir pramogos",
      et: "Hobid ja meelelahutus",
      ru: "Хобби и досуг",
    },
    slug: "hobbies-leisure",
    children: [
      {
        name: {
          en: "Books & Magazines",
          lv: "Grāmatas un žurnāli",
          lt: "Knygos ir žurnalai",
          et: "Raamatud ja ajakirjad",
          ru: "Книги и журналы",
        },
        slug: "books-magazines",
      },
      {
        name: {
          en: "Music & Instruments",
          lv: "Mūzika un instrumenti",
          lt: "Muzika ir instrumentai",
          et: "Muusika ja pillid",
          ru: "Музыка и инструменты",
        },
        slug: "music-instruments",
      },
      {
        name: {
          en: "Collectibles",
          lv: "Kolekcionējamie",
          lt: "Kolekciniai",
          et: "Kollektsioonid",
          ru: "Коллекционирование",
        },
        slug: "collectibles",
      },
      {
        name: {
          en: "Board Games",
          lv: "Galda spēles",
          lt: "Stalo žaidimai",
          et: "Lauamängud",
          ru: "Настольные игры",
        },
        slug: "board-games",
      },
      {
        name: {
          en: "Tickets & Events",
          lv: "Biļetes un pasākumi",
          lt: "Bilietai ir renginiai",
          et: "Piletid ja üritused",
          ru: "Билеты и мероприятия",
        },
        slug: "tickets-events",
      },
    ],
  },
  {
    name: {
      en: "Agriculture",
      lv: "Lauksaimniecība",
      lt: "Žemės ūkis",
      et: "Põllumajandus",
      ru: "Сельское хозяйство",
    },
    slug: "agriculture",
    children: [
      {
        name: {
          en: "Farm Equipment",
          lv: "Lauksaimniecības tehnika",
          lt: "Žemės ūkio technika",
          et: "Põllumajandustehnika",
          ru: "Сельхозтехника",
        },
        slug: "farm-equipment",
      },
      {
        name: {
          en: "Livestock",
          lv: "Mājlopi",
          lt: "Gyvuliai",
          et: "Kariloomad",
          ru: "Скот",
        },
        slug: "livestock",
      },
      {
        name: {
          en: "Seeds & Plants",
          lv: "Sēklas un stādi",
          lt: "Sėklos ir augalai",
          et: "Seemned ja taimed",
          ru: "Семена и растения",
        },
        slug: "seeds-plants",
      },
      {
        name: {
          en: "Forestry",
          lv: "Mežsaimniecība",
          lt: "Miškininkystė",
          et: "Metsandus",
          ru: "Лесное хозяйство",
        },
        slug: "forestry",
      },
    ],
  },
];

/** Build a slug→fallback lookup that includes both parent and child slugs */
function findFallbackCategory(slug: string) {
  // Check parent categories
  for (const cat of FALLBACK_CATEGORIES) {
    if (cat.slug === slug) {
      return {
        name: cat.name,
        slug: cat.slug,
        parent: null as { slug: string; name: Record<string, string> } | null,
        children: cat.children.map((c) => ({
          id: c.slug,
          slug: c.slug,
          name: c.name,
          _count: { listings: 0 },
        })),
        _count: { listings: 0 },
      };
    }
    // Check children
    for (const child of cat.children) {
      if (child.slug === slug) {
        return {
          name: child.name,
          slug: child.slug,
          parent: { slug: cat.slug, name: cat.name },
          children: [] as {
            id: string;
            slug: string;
            name: Record<string, string>;
            _count: { listings: number };
          }[],
          _count: { listings: 0 },
        };
      }
    }
  }
  return null;
}

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { locale, slug } = await params;
  const filters = await searchParams;
  const page = parseInt(filters.page || "1", 10);
  const perPage = 24;

  let category: {
    id?: string;
    name: Record<string, string> | string;
    slug: string;
    parent: { slug: string; name: Record<string, string> | string } | null;
    children: {
      id: string;
      slug: string;
      name: Record<string, string> | string;
      _count: { listings: number };
    }[];
    _count: { listings: number };
  } | null = null;
  let dbAvailable = true;

  try {
    const dbCategory = await db.category.findFirst({
      where: { slug },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: {
              select: { listings: { where: { status: "ACTIVE" } } },
            },
          },
        },
        _count: {
          select: { listings: { where: { status: "ACTIVE" } } },
        },
      },
    });
    if (dbCategory) {
      category = dbCategory as unknown as typeof category;
    }
  } catch (e) {
    console.error("Failed to fetch category:", e);
    dbAvailable = false;
  }

  // Fall back to hardcoded catalogue when DB is unavailable or category not seeded
  if (!category) {
    const fallback = findFallbackCategory(slug);
    if (fallback) {
      category = fallback;
      dbAvailable = false;
    }
  }

  if (!category) notFound();

  // Get categoryIds to include (this category + all children)
  const categoryIds = category.id
    ? [category.id, ...category.children.map((c) => c.id)]
    : [];

  const orderBy: Record<string, string> = {};
  switch (filters.sort) {
    case "price_asc":
      orderBy.price = "asc";
      break;
    case "price_desc":
      orderBy.price = "desc";
      break;
    default:
      orderBy.createdAt = "desc";
  }

  type ListingWithRelations = Awaited<
    ReturnType<typeof db.listing.findMany>
  >[number] & {
    images: { url: string }[];
    location: { name: string | Record<string, string> } | null;
    boosts: { type: string; endAt: Date }[];
  };
  let listings: ListingWithRelations[] = [];
  let totalCount = 0;

  if (dbAvailable && categoryIds.length > 0) {
    try {
      [listings, totalCount] = await Promise.all([
        db.listing.findMany({
          where: { categoryId: { in: categoryIds }, status: "ACTIVE" },
          orderBy,
          skip: (page - 1) * perPage,
          take: perPage,
          include: {
            images: { take: 1, orderBy: { sortOrder: "asc" } },
            category: true,
            location: true,
            boosts: { where: { endAt: { gt: new Date() } } },
          },
        }) as unknown as Promise<ListingWithRelations[]>,
        db.listing.count({
          where: { categoryId: { in: categoryIds }, status: "ACTIVE" },
        }),
      ]);
    } catch (e) {
      console.error("Failed to fetch category listings:", e);
    }
  }

  const totalPages = Math.ceil(totalCount / perPage);

  // Build breadcrumb items for JSON-LD
  const breadcrumbItems = [{ name: "Home", url: `${APP_URL}/${locale}` }];
  if (category.parent) {
    breadcrumbItems.push({
      name: getLocalizedName(category.parent.name, locale),
      url: `${APP_URL}/${locale}/category/${category.parent.slug}`,
    });
  }
  breadcrumbItems.push({
    name: getLocalizedName(category.name, locale),
    url: `${APP_URL}/${locale}/category/${slug}`,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Structured data */}
      <BreadcrumbJsonLd items={breadcrumbItems} />

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        {category.parent && (
          <>
            <Link
              href={`/category/${category.parent.slug}`}
              className="hover:text-foreground"
            >
              {getLocalizedName(category.parent.name, locale)}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground">
          {getLocalizedName(category.name, locale)}
        </span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {getLocalizedName(category.name, locale)}
        </h1>
        <p className="mt-1 text-muted-foreground">{totalCount} listings</p>
      </div>

      {/* Subcategories */}
      {category.children.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {category.children.map((sub) => (
            <Link key={sub.id} href={`/category/${sub.slug}`}>
              <Badge
                variant="outline"
                className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted"
              >
                {getLocalizedName(sub.name, locale)}
                <span className="ml-1.5 text-muted-foreground">
                  ({sub._count.listings})
                </span>
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-2 text-lg font-semibold">No listings yet</p>
          <p className="text-muted-foreground">
            Be the first to post in this category
          </p>
          <Link href="/sell">
            <Button className="mt-4">Post a listing</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{
                id: listing.id,
                title: listing.title,
                price: listing.price,
                currency: listing.currency,
                location: listing.location
                  ? getLocalizedName(listing.location.name, locale)
                  : "",
                imageUrl: listing.images[0]?.url || "/placeholder.svg",
                imageCount: listing.images.length,
                createdAt: listing.createdAt,
                isFeatured: listing.boosts.some((b) => b.type === "FEATURED"),
                hasAgent: false,
                slug: listing.slug,
              }}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/category/${slug}?page=${page - 1}`}>
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/category/${slug}?page=${page + 1}`}>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
