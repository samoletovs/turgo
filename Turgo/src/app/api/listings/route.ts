import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { processAndStoreImage, validateUpload } from "@/server/services/storage";
import { URGENCY_HOURS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();

    // ── Extract listing fields ──
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priceRaw = formData.get("price") as string;
    const currency = (formData.get("currency") as string) || "EUR";
    const negotiable = formData.get("negotiable") !== "false";
    const condition = (formData.get("condition") as string) || "USED";
    const categoryId = formData.get("categoryId") as string;
    const locationId = formData.get("locationId") as string | null;
    const contactPhone = formData.get("contactPhone") as string | null;
    const contactEmail = formData.get("contactEmail") as string | null;
    const status = (formData.get("status") as string) || "DRAFT";

    // ── Validate required fields ──
    if (!title || title.length < 5) {
      return NextResponse.json({ error: "Title must be at least 5 characters" }, { status: 400 });
    }
    if (!description || description.length < 20) {
      return NextResponse.json({ error: `Description must be at least 20 characters (got ${description?.length || 0})` }, { status: 400 });
    }
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: "Category is required. Please select a category." }, { status: 400 });
    }

    // Verify categoryId exists in DB
    const categoryExists = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!categoryExists) {
      return NextResponse.json({ error: "Selected category not found. Database may need seeding." }, { status: 400 });
    }

    // ── Generate slug ──
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    // ── Agent config (from selling wizard) ──
    const agentEnabled = formData.get("agent[enabled]") === "true";
    const agentAutoRespond = formData.get("agent[autoRespond]") === "true";
    const agentAutoNegotiate = formData.get("agent[autoNegotiate]") === "true";
    const agentAutoBoost = formData.get("agent[autoBoost]") === "true";
    const agentUrgency = (formData.get("agent[urgency]") as string) || "ONE_WEEK";
    const agentMinPriceRaw = formData.get("agent[minPrice]") as string | null;
    const agentMinPrice = agentMinPriceRaw ? parseFloat(agentMinPriceRaw) : price * 0.7;

    // ── Create listing in DB ──
    const listing = await db.listing.create({
      data: {
        title,
        slug,
        description,
        price,
        currency,
        negotiable,
        condition: condition as "NEW" | "USED" | "REFURBISHED",
        status: status as "DRAFT" | "ACTIVE",
        categoryId,
        locationId: locationId || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        userId: session.user.id,
        managedByAgent: agentEnabled,
        expiresAt:
          status === "ACTIVE"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : undefined,
      },
    });

    // ── Record initial price ──
    await db.priceHistory.create({
      data: {
        listingId: listing.id,
        price: listing.price,
      },
    });

    // ── Upload photos ──
    const photos = formData.getAll("photos") as File[];
    if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const validation = validateUpload(photo);
        if (!validation.valid) {
          console.warn(`[LISTING_UPLOAD] Skipping invalid file: ${validation.error}`);
          continue;
        }

        try {
          const buffer = Buffer.from(await photo.arrayBuffer());
          const result = await processAndStoreImage(buffer, photo.name);
          await db.listingImage.create({
            data: {
              listingId: listing.id,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl,
              sortOrder: i,
              isPrimary: i === 0,
            },
          });
        } catch (err) {
          console.error(`[LISTING_UPLOAD] Failed to process photo ${photo.name}:`, err);
        }
      }
    }

    // ── Create SellingAgent if enabled ──
    if (agentEnabled) {
      const urgencyHours = URGENCY_HOURS[agentUrgency] || 168;
      await db.sellingAgent.create({
        data: {
          userId: session.user.id,
          listingId: listing.id,
          urgency: agentUrgency as "ONE_DAY" | "THREE_DAYS" | "ONE_WEEK" | "TWO_WEEKS" | "ONE_MONTH" | "NO_RUSH",
          startingPrice: price,
          currentPrice: price,
          minimumPrice: agentMinPrice,
          autoRespond: agentAutoRespond,
          autoNegotiate: agentAutoNegotiate,
          autoBoost: agentAutoBoost,
          deadline: new Date(Date.now() + urgencyHours * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
    }

    return NextResponse.json({
      id: listing.id,
      slug: listing.slug,
      status: listing.status,
    });
  } catch (error) {
    console.error("[API_LISTINGS_POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Check for common Prisma errors
    if (message.includes("ECONNREFUSED") || message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Database connection failed. Please ensure the database is running." },
        { status: 503 }
      );
    }
    if (message.includes("Foreign key constraint")) {
      return NextResponse.json(
        { error: "Invalid category or location. The database may need to be seeded." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create listing. Please try again." },
      { status: 500 }
    );
  }
}
