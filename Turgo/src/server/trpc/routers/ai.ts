import {
  createTRPCRouter,
  protectedProcedure,
  tieredProcedure,
} from "@/server/trpc";
import { conciergeMessageSchema } from "@/lib/validators";
import { z } from "zod";
import {
  aiComplete,
  aiAnalyzeImage,
  createMessages,
  getAiProviderInfo,
} from "@/server/services/ai";
import type { UserTier } from "@/server/services/ai";

export const aiRouter = createTRPCRouter({
  /** Concierge chat — intent detection and routing (authenticated users only) */
  concierge: protectedProcedure
    .input(conciergeMessageSchema)
    .mutation(async ({ input }) => {
      const { processConciergeMessage } =
        await import("@/server/services/agent-concierge");
      return processConciergeMessage(
        input.message,
        input.conversationHistory as {
          role: "system" | "user" | "assistant";
          content: string;
        }[],
      );
    }),

  /** Generate listing description from AI (tier-aware) */
  generateDescription: tieredProcedure
    .input(
      z.object({
        title: z.string(),
        category: z.string(),
        condition: z.string(),
        attributes: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userTier = (ctx as unknown as { userTier: UserTier }).userTier;

      const messages = createMessages(
        `You are a classifieds listing description writer for the Baltic region.
Write a compelling listing description for the item below. Keep it concise (3-5 sentences), highlight key features, and make it appealing to buyers.
Category: ${input.category}
Condition: ${input.condition}
${input.attributes ? `Attributes: ${JSON.stringify(input.attributes)}` : ""}`,
        `Write a listing description for: "${input.title}"`,
      );

      const result = await aiComplete(
        { messages, temperature: 0.7, maxTokens: 300 },
        userTier,
      );

      return {
        description: result.content,
        confidence:
          result.provider === "azure"
            ? 0.95
            : result.provider === "github"
              ? 0.85
              : 0.6,
        provider: result.provider,
      };
    }),

  /** Suggest price based on market data (tier-aware) */
  suggestPrice: tieredProcedure
    .input(
      z.object({
        categoryId: z.string(),
        title: z.string(),
        condition: z.string(),
        locationId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userTier = (ctx as unknown as { userTier: UserTier }).userTier;

      // Get market data for this category
      const snapshots = await ctx.db.marketSnapshot.findMany({
        where: {
          categoryId: input.categoryId,
          ...(input.locationId ? { locationId: input.locationId } : {}),
        },
        orderBy: { date: "desc" },
        take: 30,
      });

      if (snapshots.length === 0) {
        return {
          suggestedPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          confidence: 0,
          reasoning: "No market data available yet for this category.",
          comparableListings: 0,
        };
      }

      const latest = snapshots[0];

      // For paid users, use AI for refined pricing analysis
      if (userTier === "pro" || userTier === "business") {
        try {
          const messages = createMessages(
            `You are a pricing expert for classifieds in the Baltic region.
Given market data and item details, suggest an optimal listing price.

Market data for this category:
- Median price: €${latest.medianPrice}
- Average price: €${latest.avgPrice}
- Min: €${latest.minPrice}, Max: €${latest.maxPrice}
- ${latest.listingCount} active listings

Respond in JSON: {"suggestedPrice": number, "reasoning": "string", "confidence": 0-1}`,
            `Item: "${input.title}", Condition: ${input.condition}`,
          );

          const result = await aiComplete(
            {
              messages,
              temperature: 0.3,
              maxTokens: 200,
              responseFormat: { type: "json_object" },
            },
            userTier,
          );

          try {
            const parsed = JSON.parse(result.content);
            return {
              suggestedPrice: parsed.suggestedPrice || latest.medianPrice || 0,
              minPrice: latest.minPrice ?? 0,
              maxPrice: latest.maxPrice ?? 0,
              confidence: parsed.confidence || 0.8,
              reasoning:
                parsed.reasoning ||
                `Based on ${latest.listingCount} similar listings.`,
              comparableListings: latest.listingCount,
            };
          } catch {
            // Fall through to default
          }
        } catch {
          // Fall through to default
        }
      }

      return {
        suggestedPrice: latest.medianPrice ?? latest.avgPrice ?? 0,
        minPrice: latest.minPrice ?? 0,
        maxPrice: latest.maxPrice ?? 0,
        confidence: 0.7,
        reasoning: `Based on ${latest.listingCount} similar listings in this category.`,
        comparableListings: latest.listingCount,
      };
    }),

  /** Analyze uploaded image (paid-only for full analysis) */
  analyzeImage: tieredProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const userTier = (ctx as unknown as { userTier: UserTier }).userTier;

      const result = await aiAnalyzeImage(input.imageUrl, undefined, userTier);

      try {
        const parsed = JSON.parse(result.content);
        return {
          description: parsed.description || "",
          tags: parsed.tags || [],
          suggestedCategory: parsed.suggestedCategory,
          suggestedTitle: parsed.suggestedTitle,
          confidence: parsed.confidence || 0.5,
          provider: result.provider,
        };
      } catch {
        return {
          description: result.content,
          tags: [],
          confidence: 0.3,
          provider: result.provider,
        };
      }
    }),

  /** Get current AI provider info (for debugging/display) */
  providerInfo: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await ctx.db.subscription.findUnique({
      where: { userId: ctx.session.user.id! },
      include: { plan: true },
    });

    const tier: UserTier =
      subscription?.plan.name === "BUSINESS"
        ? "business"
        : subscription?.plan.name === "PRO"
          ? "pro"
          : "free";

    return getAiProviderInfo(tier);
  }),
});
