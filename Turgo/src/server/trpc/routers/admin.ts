/**
 * Admin tRPC Router — moderation, users, analytics, revenue, agents, escalations
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

export const adminRouter = createTRPCRouter({
  // ──────────────────────────────────────────
  // DASHBOARD OVERVIEW
  // ──────────────────────────────────────────
  overview: adminProcedure.query(async ({ ctx }) => {
    const [
      totalUsers,
      totalListings,
      activeListings,
      pendingModeration,
      openReports,
      pendingEscalations,
    ] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.listing.count(),
      ctx.db.listing.count({ where: { status: "ACTIVE" } }),
      ctx.db.listing.count({ where: { status: "MODERATION" } }),
      ctx.db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      ctx.db.escalationItem.count({ where: { status: "PENDING" } }),
    ]);

    // New users last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersLast30 = await ctx.db.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return {
      totalUsers,
      totalListings,
      activeListings,
      pendingModeration,
      openReports,
      pendingEscalations,
      newUsersLast30,
    };
  }),

  // ──────────────────────────────────────────
  // MODERATION QUEUE
  // ──────────────────────────────────────────
  moderationQueue: adminProcedure
    .input(
      z.object({
        status: z.enum(["MODERATION", "REJECTED", "ACTIVE"]).default("MODERATION"),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.listing.findMany({
          where: { status: input.status },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true } },
            images: { take: 1, orderBy: { sortOrder: "asc" } },
            location: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.db.listing.count({ where: { status: input.status } }),
      ]);

      return { items, total, pages: Math.ceil(total / input.limit) };
    }),

  moderateAction: adminProcedure
    .input(
      z.object({
        listingId: z.string(),
        action: z.enum(["APPROVE", "REJECT", "FLAG"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const statusMap = {
        APPROVE: "ACTIVE" as const,
        REJECT: "REJECTED" as const,
        FLAG: "MODERATION" as const,
      };

      await ctx.db.$transaction([
        ctx.db.listing.update({
          where: { id: input.listingId },
          data: { status: statusMap[input.action] },
        }),
        ctx.db.moderationLog.create({
          data: {
            listingId: input.listingId,
            adminId: ctx.session.user.id!,
            action: input.action,
            reason: input.reason,
          },
        }),
      ]);

      return { success: true };
    }),

  // ──────────────────────────────────────────
  // CATEGORY MANAGEMENT
  // ──────────────────────────────────────────
  categories: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      include: {
        _count: { select: { listings: true, children: true } },
        children: {
          include: { _count: { select: { listings: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    });
  }),

  createCategory: adminProcedure
    .input(
      z.object({
        name: z.record(z.string(), z.string()),
        slug: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().nullish(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { parentId, ...rest } = input;
      return ctx.db.category.create({
        data: { ...rest, ...(parentId ? { parent: { connect: { id: parentId } } } : {}) },
      });
    }),

  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.record(z.string(), z.string()).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().nullish(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, parentId, ...rest } = input;
      return ctx.db.category.update({
        where: { id },
        data: {
          ...rest,
          ...(parentId !== undefined
            ? parentId
              ? { parent: { connect: { id: parentId } } }
              : { parent: { disconnect: true } }
            : {}),
        },
      });
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const childCount = await ctx.db.category.count({ where: { parentId: input.id } });
      if (childCount > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete category with children" });
      }
      const listingCount = await ctx.db.listing.count({ where: { categoryId: input.id } });
      if (listingCount > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete category with listings" });
      }
      return ctx.db.category.delete({ where: { id: input.id } });
    }),

  reorderCategories: adminProcedure
    .input(z.array(z.object({ id: z.string(), sortOrder: z.number() })))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.map((item) =>
          ctx.db.category.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          })
        )
      );
      return { success: true };
    }),

  // ──────────────────────────────────────────
  // REVENUE DASHBOARD
  // ──────────────────────────────────────────
  revenue: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Active subscriptions by plan
    const subscriptions = await ctx.db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: true },
    });

    const planCounts = { FREE: 0, PRO: 0, BUSINESS: 0 };
    let mrr = 0;
    for (const sub of subscriptions) {
      planCounts[sub.plan.name] = (planCounts[sub.plan.name] || 0) + 1;
      if (sub.plan.interval === "MONTHLY") {
        mrr += sub.plan.price;
      } else {
        mrr += sub.plan.price / 12;
      }
    }

    // Boost revenue this month
    const boosts = await ctx.db.listingBoost.findMany({
      where: { startAt: { gte: startOfMonth } },
    });
    const boostRevenue = boosts.reduce((sum, b) => {
      const prices: Record<string, number> = { FEATURED: 4.99, HIGHLIGHTED: 2.99, TOP: 9.99 };
      return sum + (prices[b.type] || 0);
    }, 0);

    // Last month subscriptions for churn
    const lastMonthCancelled = await ctx.db.subscription.count({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
    });

    const totalActiveStart = subscriptions.length + lastMonthCancelled;
    const churnRate = totalActiveStart > 0 ? (lastMonthCancelled / totalActiveStart) * 100 : 0;

    // MRR over last 12 months (approximation from subscription counts)
    const mrrHistory: { month: string; mrr: number; boosts: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString("en", { month: "short", year: "2-digit" });

      const activeSubs = await ctx.db.subscription.count({
        where: {
          status: "ACTIVE",
          createdAt: { lt: endD },
        },
      });

      const monthBoosts = await ctx.db.listingBoost.count({
        where: {
          startAt: { gte: d, lt: endD },
        },
      });

      mrrHistory.push({
        month: label,
        mrr: activeSubs * 8, // rough avg
        boosts: monthBoosts * 5, // rough avg
      });
    }

    return {
      mrr: Math.round(mrr * 100) / 100,
      boostRevenue: Math.round(boostRevenue * 100) / 100,
      planCounts,
      churnRate: Math.round(churnRate * 10) / 10,
      totalSubscribers: subscriptions.length,
      mrrHistory,
    };
  }),

  // ──────────────────────────────────────────
  // ANALYTICS DASHBOARD
  // ──────────────────────────────────────────
  analytics: adminProcedure.query(async ({ ctx }) => {
    // Listings per category
    const categoryCounts = await ctx.db.category.findMany({
      where: { parentId: null },
      select: { name: true, slug: true, _count: { select: { listings: true } } },
      orderBy: { sortOrder: "asc" },
    });

    // Listings per country
    const countryCounts = await ctx.db.location.findMany({
      where: { type: "COUNTRY" },
      select: { name: true, countryCode: true, _count: { select: { listings: true } } },
    });

    // New listings over past 30 days
    const listingsOverTime: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const count = await ctx.db.listing.count({
        where: { createdAt: { gte: start, lt: end } },
      });
      listingsOverTime.push({
        date: start.toISOString().slice(0, 10),
        count,
      });
    }

    // User registration trends last 30 days
    const registrationTrend: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const count = await ctx.db.user.count({
        where: { createdAt: { gte: start, lt: end } },
      });
      registrationTrend.push({
        date: start.toISOString().slice(0, 10),
        count,
      });
    }

    // User registrations by country (via default location)
    const usersByCountry = await ctx.db.location.findMany({
      where: { type: "COUNTRY" },
      select: { name: true, countryCode: true, _count: { select: { users: true } } },
    });

    // Popular searches
    const popularSearches = await ctx.db.searchLog.groupBy({
      by: ["query"],
      _count: { query: true },
      orderBy: { _count: { query: "desc" } },
      take: 50,
    });

    return {
      categoryCounts: categoryCounts.map((c) => ({
        name: (c.name as Record<string, string>).en || c.slug,
        count: c._count.listings,
      })),
      countryCounts: countryCounts.map((c) => ({
        name: (c.name as Record<string, string>).en || c.countryCode || "Unknown",
        code: c.countryCode,
        count: c._count.listings,
      })),
      listingsOverTime,
      registrationTrend,
      usersByCountry: usersByCountry.map((c) => ({
        name: (c.name as Record<string, string>).en || c.countryCode || "Unknown",
        code: c.countryCode,
        count: c._count.users,
      })),
      popularSearches: popularSearches.map((s: { query: string; _count: { query: number } }) => ({
        word: s.query,
        count: s._count.query,
      })),
    };
  }),

  // ──────────────────────────────────────────
  // USER MANAGEMENT
  // ──────────────────────────────────────────
  users: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.search) {
        where.OR = [
          { email: { contains: input.search, mode: "insensitive" } },
          { name: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.role) where.role = input.role;

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
            isBanned: true,
            bannedUntil: true,
            _count: { select: { listings: true, warnings: true, bans: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.db.user.count({ where }),
      ]);

      return { users, total, pages: Math.ceil(total / input.limit) };
    }),

  warnUser: adminProcedure
    .input(z.object({ userId: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.userWarning.create({
        data: {
          userId: input.userId,
          adminId: ctx.session.user.id!,
          reason: input.reason,
        },
      });
    }),

  banUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.string().min(1),
        durationDays: z.number().optional(), // null = permanent
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.durationDays
        ? new Date(Date.now() + input.durationDays * 86400000)
        : null;

      await ctx.db.$transaction([
        ctx.db.userBan.create({
          data: {
            userId: input.userId,
            adminId: ctx.session.user.id!,
            reason: input.reason,
            expiresAt,
          },
        }),
        ctx.db.user.update({
          where: { id: input.userId },
          data: { isBanned: true, bannedUntil: expiresAt },
        }),
      ]);

      return { success: true };
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction([
        ctx.db.userBan.updateMany({
          where: { userId: input.userId, isActive: true },
          data: { isActive: false },
        }),
        ctx.db.user.update({
          where: { id: input.userId },
          data: { isBanned: false, bannedUntil: null },
        }),
      ]);
      return { success: true };
    }),

  userDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          warnings: { orderBy: { createdAt: "desc" } },
          bans: { orderBy: { createdAt: "desc" } },
          _count: {
            select: { listings: true, sentMessages: true, reviewsGiven: true },
          },
          subscription: { include: { plan: true } },
        },
      });
    }),

  // ──────────────────────────────────────────
  // REPORTS
  // ──────────────────────────────────────────
  reports: adminProcedure
    .input(
      z.object({
        status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;

      const [reports, total] = await Promise.all([
        ctx.db.report.findMany({
          where,
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                images: { take: 1, orderBy: { sortOrder: "asc" } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.db.report.count({ where }),
      ]);

      return { reports, total, pages: Math.ceil(total / input.limit) };
    }),

  resolveReport: adminProcedure
    .input(
      z.object({
        reportId: z.string(),
        action: z.enum(["RESOLVED", "DISMISSED"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.report.update({
        where: { id: input.reportId },
        data: {
          status: input.action,
          reviewedBy: ctx.session.user.id,
          reviewNote: input.note,
          resolvedAt: new Date(),
        },
      });
    }),

  // ──────────────────────────────────────────
  // LOCATION MANAGEMENT
  // ──────────────────────────────────────────
  locations: adminProcedure
    .input(
      z.object({
        type: z.enum(["COUNTRY", "REGION", "CITY", "DISTRICT"]).optional(),
        parentId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.type) where.type = input.type;
      if (input.parentId) where.parentId = input.parentId;
      else if (!input.type) where.parentId = null;

      return ctx.db.location.findMany({
        where,
        include: {
          _count: { select: { listings: true, children: true, users: true } },
          children: {
            include: { _count: { select: { listings: true, children: true } } },
            orderBy: { slug: "asc" },
          },
        },
        orderBy: { slug: "asc" },
      });
    }),

  createLocation: adminProcedure
    .input(
      z.object({
        name: z.record(z.string(), z.string()),
        slug: z.string().min(1),
        type: z.enum(["COUNTRY", "REGION", "CITY", "DISTRICT"]),
        parentId: z.string().nullish(),
        countryCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { parentId, ...rest } = input;
      return ctx.db.location.create({
        data: { ...rest, ...(parentId ? { parent: { connect: { id: parentId } } } : {}) },
      });
    }),

  updateLocation: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.record(z.string(), z.string()).optional(),
        slug: z.string().optional(),
        type: z.enum(["COUNTRY", "REGION", "CITY", "DISTRICT"]).optional(),
        parentId: z.string().nullish(),
        countryCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, parentId, ...rest } = input;
      return ctx.db.location.update({
        where: { id },
        data: {
          ...rest,
          ...(parentId !== undefined
            ? parentId
              ? { parent: { connect: { id: parentId } } }
              : { parent: { disconnect: true } }
            : {}),
        },
      });
    }),

  deleteLocation: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const childCount = await ctx.db.location.count({ where: { parentId: input.id } });
      if (childCount > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete location with children" });
      }
      return ctx.db.location.delete({ where: { id: input.id } });
    }),

  // ──────────────────────────────────────────
  // AGENT MONITORING
  // ──────────────────────────────────────────
  agentMonitoring: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Active agent counts
    const [activeSellingAgents, activeBuyingAgents] = await Promise.all([
      ctx.db.sellingAgent.count({ where: { status: "ACTIVE" } }),
      ctx.db.buyingAgent.count({ where: { status: "ACTIVE" } }),
    ]);

    // Recent actions (last 24h)
    const oneDayAgo = new Date(now.getTime() - 86400000);
    const recentActions = await ctx.db.agentAction.count({
      where: { createdAt: { gte: oneDayAgo } },
    });

    // Error rate (actions with rejection in last 24h)
    const rejectedActions = await ctx.db.agentAction.count({
      where: { createdAt: { gte: oneDayAgo }, rejectedAt: { not: null } },
    });

    const errorRate = recentActions > 0 ? (rejectedActions / recentActions) * 100 : 0;

    // Metrics over last 14 days
    const metricsHistory = await ctx.db.agentMetrics.findMany({
      where: {
        date: { gte: new Date(now.getTime() - 14 * 86400000) },
      },
      orderBy: { date: "asc" },
    });

    // Today's metrics
    const todayMetrics = await ctx.db.agentMetrics.findMany({
      where: { date: today },
    });

    const totalAiCostToday = todayMetrics.reduce((s: number, m: { aiCostCents: number }) => s + m.aiCostCents, 0);
    const totalTokensToday = todayMetrics.reduce((s: number, m: { aiTokensUsed: number }) => s + m.aiTokensUsed, 0);

    // Agent status breakdown
    const sellingByStatus = await ctx.db.sellingAgent.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const buyingByStatus = await ctx.db.buyingAgent.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    return {
      activeSellingAgents,
      activeBuyingAgents,
      recentActions,
      errorRate: Math.round(errorRate * 10) / 10,
      aiCostTodayCents: totalAiCostToday,
      aiTokensToday: totalTokensToday,
      metricsHistory: metricsHistory.map((m: { date: Date; agentType: string; itemsProcessed: number; errorsCount: number; avgResponseMs: number; aiTokensUsed: number; aiCostCents: number }) => ({
        date: m.date.toISOString().slice(0, 10),
        agentType: m.agentType,
        processed: m.itemsProcessed,
        errors: m.errorsCount,
        avgMs: m.avgResponseMs,
        tokens: m.aiTokensUsed,
        costCents: m.aiCostCents,
      })),
      sellingByStatus: Object.fromEntries(
        sellingByStatus.map((s) => [s.status, s._count.status])
      ),
      buyingByStatus: Object.fromEntries(
        buyingByStatus.map((s) => [s.status, s._count.status])
      ),
    };
  }),

  // ──────────────────────────────────────────
  // ESCALATION QUEUE
  // ──────────────────────────────────────────
  escalations: adminProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
        source: z.enum(["SELLING_AGENT", "BUYING_AGENT", "CONCIERGE", "AUTO_MODERATION"]).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.source) where.source = input.source;

      const [items, total] = await Promise.all([
        ctx.db.escalationItem.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.db.escalationItem.count({ where }),
      ]);

      return { items, total, pages: Math.ceil(total / input.limit) };
    }),

  resolveEscalation: adminProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["RESOLVED", "DISMISSED"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.escalationItem.update({
        where: { id: input.id },
        data: {
          status: input.action,
          resolvedBy: ctx.session.user.id,
          resolvedNote: input.note,
          resolvedAt: new Date(),
        },
      });
    }),

  assignEscalation: adminProcedure
    .input(z.object({ id: z.string(), assignTo: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.escalationItem.update({
        where: { id: input.id },
        data: { assignedTo: input.assignTo, status: "IN_REVIEW" },
      });
    }),
});
