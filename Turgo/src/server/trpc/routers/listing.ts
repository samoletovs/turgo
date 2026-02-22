import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  createRateLimitedProcedure,
} from "@/server/trpc";
import {
  createListingSchema,
  updateListingSchema,
  listingFilterSchema,
} from "@/lib/validators";
import { RATE_LIMITS } from "@/lib/constants";
import { incrementViewCount } from "@/server/services/view-counter";

export const listingRouter = createTRPCRouter({
  /** Get a single listing by ID */
  getById: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const listing = await ctx.db.listing.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          category: true,
          location: true,
          images: { orderBy: { sortOrder: "asc" } },
          attributes: { include: { categoryAttribute: true } },
          sellingAgent: true,
          boosts: { where: { endAt: { gte: new Date() } } },
          _count: { select: { favorites: true } },
        },
      });

      if (listing) {
        // Increment view count (fire-and-forget via Redis-backed service)
        const ip =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          ctx.headers.get("x-real-ip");
        const userAgent = ctx.headers.get("user-agent");

        void incrementViewCount({ listingId: input.id, ip, userAgent });
      }

      return listing;
    }),

  /** List listings with filters */
  list: publicProcedure
    .input(listingFilterSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, sortBy, query, ...filters } = input;

      const where: Prisma.ListingWhereInput = {
        status: filters.status || "ACTIVE",
      };
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.locationId) where.locationId = filters.locationId;
      if (filters.condition) where.condition = filters.condition;
      if (filters.minPrice || filters.maxPrice) {
        where.price = {
          ...(filters.minPrice ? { gte: filters.minPrice } : {}),
          ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
        };
      }
      if (query) {
        where.OR = [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ];
      }

      const orderBy: Record<string, string> = {};
      switch (sortBy) {
        case "price_asc":
          orderBy.price = "asc";
          break;
        case "price_desc":
          orderBy.price = "desc";
          break;
        case "views":
          orderBy.viewCount = "desc";
          break;
        case "oldest":
          orderBy.createdAt = "asc";
          break;
        default:
          orderBy.createdAt = "desc";
      }

      const [listings, total] = await Promise.all([
        ctx.db.listing.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            location: true,
            category: true,
            _count: { select: { favorites: true } },
          },
        }),
        ctx.db.listing.count({ where }),
      ]);

      return {
        listings,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /** Create a new listing */
  create: createRateLimitedProcedure(RATE_LIMITS.LISTING_CREATE)
    .input(createListingSchema)
    .mutation(async ({ ctx, input }) => {
      // Generate slug from title
      const baseSlug = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const listing = await ctx.db.listing.create({
        data: {
          ...input,
          slug,
          userId: ctx.session.user.id!,
          status: "DRAFT",
        },
      });

      // Record initial price
      await ctx.db.priceHistory.create({
        data: {
          listingId: listing.id,
          price: listing.price,
        },
      });

      return listing;
    }),

  /** Update a listing */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        data: updateListingSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.listing.findFirst({
        where: { id: input.id, userId: ctx.session.user.id! },
      });

      if (!existing) {
        throw new Error("Listing not found or unauthorized");
      }

      const listing = await ctx.db.listing.update({
        where: { id: input.id },
        data: input.data,
      });

      // Track price changes
      if (input.data.price && input.data.price !== existing.price) {
        await ctx.db.priceHistory.create({
          data: {
            listingId: listing.id,
            price: input.data.price,
          },
        });
      }

      return listing;
    }),

  /** Publish a draft listing */
  publish: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.listing.update({
        where: { id: input.id, userId: ctx.session.user.id! },
        data: {
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    }),

  /** Delete a listing */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.listing.delete({
        where: { id: input.id, userId: ctx.session.user.id! },
      });
    }),

  /** Get my listings */
  myListings: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "DRAFT",
            "ACTIVE",
            "SOLD",
            "EXPIRED",
            "MODERATION",
            "REJECTED",
          ])
          .optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ListingWhereInput = { userId: ctx.session.user.id! };
      if (input.status) where.status = input.status;

      const [listings, total] = await Promise.all([
        ctx.db.listing.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            sellingAgent: true,
            _count: { select: { favorites: true, messages: true } },
          },
        }),
        ctx.db.listing.count({ where }),
      ]);

      return {
        listings,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /** Lightweight view-count increment (fire-and-forget from client) */
  incrementView: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        ctx.headers.get("x-real-ip");
      const userAgent = ctx.headers.get("user-agent");

      void incrementViewCount({ listingId: input.id, ip, userAgent });
      return { success: true };
    }),

  /** Get featured / boosted listings for homepage */
  featured: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      return ctx.db.listing.findMany({
        where: {
          status: "ACTIVE",
          boosts: { some: { startAt: { lte: now }, endAt: { gte: now } } },
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          location: true,
          category: true,
        },
      });
    }),

  /** Report a listing */
  report: protectedProcedure
    .input(
      z.object({
        listingId: z.string().cuid(),
        reason: z.enum([
          "SPAM",
          "FRAUD",
          "INAPPROPRIATE",
          "DUPLICATE",
          "WRONG_CATEGORY",
          "MISLEADING_PRICE",
          "PROHIBITED_ITEM",
          "OTHER",
        ]),
        description: z.string().min(10).max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;

      // Verify listing exists
      const listing = await ctx.db.listing.findUnique({
        where: { id: input.listingId },
        select: { userId: true },
      });

      if (!listing) {
        throw new Error("Listing not found");
      }

      // Prevent self-reporting
      if (listing.userId === userId) {
        throw new Error("You cannot report your own listing");
      }

      // Prevent duplicate reports
      const existing = await ctx.db.report.findFirst({
        where: {
          listingId: input.listingId,
          reporterId: userId,
          status: { in: ["OPEN", "REVIEWING"] },
        },
      });

      if (existing) {
        throw new Error("You have already reported this listing");
      }

      return ctx.db.report.create({
        data: {
          listingId: input.listingId,
          reporterId: userId,
          reason: input.reason,
          details: input.description,
        },
      });
    }),
});
