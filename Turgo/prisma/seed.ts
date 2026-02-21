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

  const categories: { name: string; slug: string; icon: string; children: { name: string; slug: string }[] }[] = [
    {
      name: "Transport",
      slug: "transport",
      icon: "car",
      children: [
        { name: "Cars", slug: "cars" },
        { name: "Motorcycles", slug: "motorcycles" },
        { name: "Trucks & Buses", slug: "trucks-buses" },
        { name: "Spare Parts", slug: "spare-parts" },
        { name: "Tires & Wheels", slug: "tires-wheels" },
        { name: "Boats", slug: "boats" },
        { name: "Bicycles", slug: "bicycles" },
        { name: "Other Transport", slug: "other-transport" },
      ],
    },
    {
      name: "Real Estate",
      slug: "real-estate",
      icon: "home",
      children: [
        { name: "Apartments - Sale", slug: "apartments-sale" },
        { name: "Apartments - Rent", slug: "apartments-rent" },
        { name: "Houses - Sale", slug: "houses-sale" },
        { name: "Houses - Rent", slug: "houses-rent" },
        { name: "Land", slug: "land" },
        { name: "Commercial", slug: "commercial-property" },
        { name: "Garages", slug: "garages" },
      ],
    },
    {
      name: "Electronics",
      slug: "electronics",
      icon: "smartphone",
      children: [
        { name: "Phones & Tablets", slug: "phones-tablets" },
        { name: "Computers", slug: "computers" },
        { name: "Laptops", slug: "laptops" },
        { name: "TVs & Audio", slug: "tvs-audio" },
        { name: "Gaming", slug: "gaming" },
        { name: "Cameras", slug: "cameras" },
        { name: "Accessories", slug: "electronics-accessories" },
      ],
    },
    {
      name: "Home & Garden",
      slug: "home-garden",
      icon: "sofa",
      children: [
        { name: "Furniture", slug: "furniture" },
        { name: "Appliances", slug: "appliances" },
        { name: "Tools", slug: "tools" },
        { name: "Garden", slug: "garden" },
        { name: "Renovation", slug: "renovation" },
        { name: "Decor", slug: "decor" },
      ],
    },
    {
      name: "Fashion",
      slug: "fashion",
      icon: "shirt",
      children: [
        { name: "Women's Clothing", slug: "womens-clothing" },
        { name: "Men's Clothing", slug: "mens-clothing" },
        { name: "Children's Clothing", slug: "childrens-clothing" },
        { name: "Shoes", slug: "shoes" },
        { name: "Bags & Accessories", slug: "bags-accessories" },
        { name: "Watches & Jewelry", slug: "watches-jewelry" },
      ],
    },
    {
      name: "Jobs",
      slug: "jobs",
      icon: "briefcase",
      children: [
        { name: "IT & Telecom", slug: "it-telecom" },
        { name: "Finance & Accounting", slug: "finance-accounting" },
        { name: "Sales & Marketing", slug: "sales-marketing" },
        { name: "Construction", slug: "construction-jobs" },
        { name: "Healthcare", slug: "healthcare-jobs" },
        { name: "Education", slug: "education-jobs" },
        { name: "Service Industry", slug: "service-industry" },
        { name: "Other Jobs", slug: "other-jobs" },
      ],
    },
    {
      name: "Services",
      slug: "services",
      icon: "wrench",
      children: [
        { name: "Construction & Repair", slug: "construction-repair" },
        { name: "Transportation", slug: "transportation-services" },
        { name: "Beauty & Health", slug: "beauty-health" },
        { name: "Education & Tutoring", slug: "education-tutoring" },
        { name: "IT Services", slug: "it-services" },
        { name: "Other Services", slug: "other-services" },
      ],
    },
    {
      name: "Kids & Baby",
      slug: "kids-baby",
      icon: "baby",
      children: [
        { name: "Strollers", slug: "strollers" },
        { name: "Toys", slug: "toys" },
        { name: "Baby Clothes", slug: "baby-clothes" },
        { name: "Furniture & Safety", slug: "kids-furniture" },
        { name: "School Supplies", slug: "school-supplies" },
      ],
    },
    {
      name: "Sports & Outdoors",
      slug: "sports-outdoors",
      icon: "dumbbell",
      children: [
        { name: "Gym Equipment", slug: "gym-equipment" },
        { name: "Winter Sports", slug: "winter-sports" },
        { name: "Water Sports", slug: "water-sports" },
        { name: "Camping & Hiking", slug: "camping-hiking" },
        { name: "Team Sports", slug: "team-sports" },
        { name: "Fishing & Hunting", slug: "fishing-hunting" },
      ],
    },
    {
      name: "Pets",
      slug: "pets",
      icon: "paw-print",
      children: [
        { name: "Dogs", slug: "dogs" },
        { name: "Cats", slug: "cats" },
        { name: "Birds", slug: "birds" },
        { name: "Fish & Aquariums", slug: "fish-aquariums" },
        { name: "Pet Supplies", slug: "pet-supplies" },
        { name: "Other Animals", slug: "other-animals" },
      ],
    },
    {
      name: "Hobbies & Leisure",
      slug: "hobbies-leisure",
      icon: "palette",
      children: [
        { name: "Books & Magazines", slug: "books-magazines" },
        { name: "Music & Instruments", slug: "music-instruments" },
        { name: "Collectibles", slug: "collectibles" },
        { name: "Board Games", slug: "board-games" },
        { name: "Tickets & Events", slug: "tickets-events" },
      ],
    },
    {
      name: "Agriculture",
      slug: "agriculture",
      icon: "tractor",
      children: [
        { name: "Farm Equipment", slug: "farm-equipment" },
        { name: "Livestock", slug: "livestock" },
        { name: "Seeds & Plants", slug: "seeds-plants" },
        { name: "Forestry", slug: "forestry" },
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
