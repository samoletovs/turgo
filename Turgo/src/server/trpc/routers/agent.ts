import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  createRateLimitedProcedure,
} from "@/server/trpc";
import {
  createSellingAgentSchema,
  createBuyingAgentSchema,
  updateAgentStatusSchema,
} from "@/lib/validators";
import { RATE_LIMITS } from "@/lib/constants";

export const agentRouter = createTRPCRouter({
  /** Create a selling agent */
  createSelling: createRateLimitedProcedure(RATE_LIMITS.AGENT_CREATE)
    .input(createSellingAgentSchema)
    .mutation(async ({ ctx, input }) => {
      // Check plan limits
      const activeCount = await ctx.db.sellingAgent.count({
        where: { userId: ctx.session.user.id!, status: "ACTIVE" },
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id! },
        include: { subscription: { include: { plan: true } } },
      });

      const maxAgents = user?.subscription?.plan?.maxSellingAgents ?? 1;
      if (activeCount >= maxAgents) {
        throw new Error(
          `You can have at most ${maxAgents} active selling agents. Upgrade your plan for more.`,
        );
      }

      const agent = await ctx.db.sellingAgent.create({
        data: {
          userId: ctx.session.user.id!,
          listingId: input.listingId!,
          urgency: input.urgency as never,
          startingPrice: input.startingPrice,
          minimumPrice: input.minimumPrice,
          currentPrice: input.startingPrice,
          maxDiscountPercent: input.maxDiscountPercent,
          autoRespond: input.autoRespond,
          autoNegotiate: input.autoNegotiate,
          autoBoost: input.autoBoost,
          autoAcceptAbove: input.autoAcceptAbove,
          status: "ACTIVE",
        },
      });

      // Mark listing as agent-managed
      await ctx.db.listing.update({
        where: { id: input.listingId! },
        data: { managedByAgent: true },
      });

      // Log initial action
      await ctx.db.agentAction.create({
        data: {
          sellingAgentId: agent.id,
          agentType: "SELLING",
          actionType: "LISTING_CREATED",
          description: `Selling agent started with price €${input.startingPrice}`,
          metadata: {
            startingPrice: input.startingPrice,
            minimumPrice: input.minimumPrice,
            urgency: input.urgency,
          },
        },
      });

      return agent;
    }),

  /** Create a buying agent */
  createBuying: createRateLimitedProcedure(RATE_LIMITS.AGENT_CREATE)
    .input(createBuyingAgentSchema)
    .mutation(async ({ ctx, input }) => {
      const activeCount = await ctx.db.buyingAgent.count({
        where: { userId: ctx.session.user.id!, status: "ACTIVE" },
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id! },
        include: { subscription: { include: { plan: true } } },
      });

      const maxAgents = user?.subscription?.plan?.maxBuyingAgents ?? 1;
      if (activeCount >= maxAgents) {
        throw new Error(
          `You can have at most ${maxAgents} active buying agents. Upgrade your plan for more.`,
        );
      }

      return ctx.db.buyingAgent.create({
        data: {
          userId: ctx.session.user.id!,
          searchCriteria:
            input.searchCriteria as unknown as Prisma.InputJsonValue,
          maxBudget: input.maxBudget,
          targetPrice: input.targetPrice,
          autoNegotiate: input.autoNegotiate,
          maxAutoOfferPrice: input.maxAutoOfferPrice,
          notifyPush: input.notifyPush,
          notifyEmail: input.notifyEmail,
          status: "ACTIVE",
        },
      });
    }),

  /** Update agent status (pause, resume, cancel) */
  updateStatus: protectedProcedure
    .input(updateAgentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      // Try selling agent first
      const sellingAgent = await ctx.db.sellingAgent.findFirst({
        where: { id: input.agentId, userId: ctx.session.user.id! },
      });

      if (sellingAgent) {
        return ctx.db.sellingAgent.update({
          where: { id: input.agentId },
          data: {
            status: input.status as never,
            ...(input.status === "COMPLETED"
              ? { completedAt: new Date() }
              : {}),
          },
        });
      }

      // Try buying agent
      return ctx.db.buyingAgent.update({
        where: { id: input.agentId },
        data: { status: input.status as never },
      });
    }),

  /** Get all my agents */
  myAgents: protectedProcedure.query(async ({ ctx }) => {
    const [sellingAgents, buyingAgents] = await Promise.all([
      ctx.db.sellingAgent.findMany({
        where: { userId: ctx.session.user.id! },
        include: {
          listing: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
          actions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      }),
      ctx.db.buyingAgent.findMany({
        where: { userId: ctx.session.user.id! },
        include: {
          matches: {
            orderBy: { dealScore: "desc" },
            take: 5,
            include: { listing: { include: { images: { take: 1 } } } },
          },
          actions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { sellingAgents, buyingAgents };
  }),

  /** Get agent detail by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Try selling agent first
      const sellingAgent = await ctx.db.sellingAgent.findFirst({
        where: { id: input.id, userId: ctx.session.user.id! },
        include: {
          listing: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
              priceHistory: { orderBy: { changedAt: "desc" } },
            },
          },
          actions: { orderBy: { createdAt: "desc" } },
        },
      });

      if (sellingAgent) {
        return { type: "selling" as const, agent: sellingAgent };
      }

      // Try buying agent
      const buyingAgent = await ctx.db.buyingAgent.findFirst({
        where: { id: input.id, userId: ctx.session.user.id! },
        include: {
          matches: {
            orderBy: { dealScore: "desc" },
            include: {
              listing: {
                include: { images: { take: 1 }, location: true },
              },
            },
          },
          actions: { orderBy: { createdAt: "desc" } },
        },
      });

      if (buyingAgent) {
        return { type: "buying" as const, agent: buyingAgent };
      }

      throw new Error("Agent not found");
    }),

  /** Get agent action timeline */
  getActions: protectedProcedure
    .input(
      z.object({
        agentId: z.string().cuid(),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const actions = await ctx.db.agentAction.findMany({
        where: {
          OR: [
            { sellingAgentId: input.agentId },
            { buyingAgentId: input.agentId },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (actions.length > input.limit) {
        const nextItem = actions.pop();
        nextCursor = nextItem!.id;
      }

      return { actions, nextCursor };
    }),

  /** Dashboard stats overview */
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id!;

    const [sellingCount, buyingCount, recentActions, totalMatches] =
      await Promise.all([
        ctx.db.sellingAgent.count({
          where: { userId, status: "ACTIVE" },
        }),
        ctx.db.buyingAgent.count({
          where: { userId, status: "ACTIVE" },
        }),
        ctx.db.agentAction.count({
          where: {
            OR: [{ sellingAgent: { userId } }, { buyingAgent: { userId } }],
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        ctx.db.agentMatch.count({
          where: { buyingAgent: { userId } },
        }),
      ]);

    return {
      activeSellingAgents: sellingCount,
      activeBuyingAgents: buyingCount,
      actionsLast24h: recentActions,
      totalMatches,
    };
  }),

  /** Handle an incoming negotiation offer */
  handleOffer: protectedProcedure
    .input(
      z.object({
        agentId: z.string().cuid(),
        offerPrice: z.number().positive(),
        buyerMessage: z.string().optional(),
        roundNumber: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db.sellingAgent.findFirst({
        where: { id: input.agentId, userId: ctx.session.user.id! },
        include: {
          listing: { select: { title: true, description: true, price: true } },
        },
      });

      if (!agent) throw new Error("Agent not found");
      if (!agent.autoNegotiate) {
        throw new Error("Auto-negotiate is not enabled for this agent");
      }

      // Dynamic import to avoid circular deps
      const { evaluateOffer } = await import("@/server/services/agent-selling");

      const result = await evaluateOffer({
        offerPrice: input.offerPrice,
        currentPrice: agent.listing.price,
        rules: {
          minPrice: agent.minimumPrice ?? agent.listing.price * 0.7,
          autoAcceptAbove: agent.autoAcceptAbove ?? agent.listing.price * 0.95,
          maxCounterRounds: 3,
          concessionRate: 0.3,
        },
        roundNumber: input.roundNumber,
        listingTitle: agent.listing.title,
        buyerMessage: input.buyerMessage,
      });

      // Log the negotiation action
      await ctx.db.agentAction.create({
        data: {
          sellingAgentId: agent.id,
          agentType: "SELLING",
          actionType: "AUTO_NEGOTIATE",
          description: result.message,
          metadata: {
            action: result.action,
            offerPrice: input.offerPrice,
            counterPrice: result.counterPrice,
            roundNumber: input.roundNumber,
            reasoning: result.reasoning,
          },
        },
      });

      return result;
    }),

  /** Get daily summary for a selling agent */
  getDailySummary: protectedProcedure
    .input(z.object({ agentId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const agent = await ctx.db.sellingAgent.findFirst({
        where: { id: input.agentId, userId: ctx.session.user.id! },
      });
      if (!agent) throw new Error("Agent not found");

      const { generateDailySummary } =
        await import("@/server/services/agent-selling");
      return generateDailySummary(input.agentId);
    }),

  /** Get boost recommendation */
  getBoostRecommendation: protectedProcedure
    .input(z.object({ agentId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const agent = await ctx.db.sellingAgent.findFirst({
        where: { id: input.agentId, userId: ctx.session.user.id! },
        include: {
          listing: {
            select: { viewCount: true, boosts: true },
          },
        },
      });
      if (!agent) throw new Error("Agent not found");

      const { shouldBoost } = await import("@/server/services/agent-selling");

      const daysActive =
        (Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return shouldBoost({
        totalViews: agent.listing.viewCount ?? 0,
        totalInquiries: 0, // Would be computed from messages
        daysActive,
        urgency: agent.urgency,
        currentlyBoosted:
          agent.listing.boosts?.some((b) => b.endAt > new Date()) ?? false,
        previousBoosts: agent.listing.boosts?.length ?? 0,
      });
    }),
});
