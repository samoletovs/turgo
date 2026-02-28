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
        // Count active listings in this category to give a better reason
        const listingCount = await ctx.db.listing.count({
          where: {
            categoryId: input.categoryId,
            status: "ACTIVE",
          },
        });

        const reason =
          listingCount === 0
            ? "No similar listings found in this category yet. You'll be one of the first!"
            : `Found ${listingCount} listing${listingCount > 1 ? "s" : ""} in this category, but not enough price history to suggest a reliable price.`;

        return {
          suggestedPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          confidence: 0,
          reasoning: reason,
          comparableListings: listingCount,
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

  /** Diagnostic status — checks AI provider connectivity (Azure OpenAI etc.) */
  diagnosticStatus: protectedProcedure.query(async () => {
    const providerInfo = getAiProviderInfo();

    const azureConfig = {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT ? "SET" : "MISSING",
      apiKey: process.env.AZURE_OPENAI_API_KEY ? "SET" : "MISSING",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    };

    let azureStatus = "not_tested";
    let azureError: string | null = null;
    let azureResponse: string | undefined;
    let azureModel: string | undefined;

    if (
      providerInfo.envProvider === "azure" &&
      process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY
    ) {
      try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const deployment =
          process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini";
        const apiVersion =
          process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

        const response = await fetch(
          `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": process.env.AZURE_OPENAI_API_KEY!,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: "Say 'OK' in one word." }],
              max_tokens: 5,
              temperature: 0,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          azureStatus = "connected";
          azureResponse = data.choices?.[0]?.message?.content;
          azureModel = data.model;
        } else {
          const errorText = await response.text();
          azureStatus = "error";
          azureError = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
        }
      } catch (e) {
        azureStatus = "unreachable";
        azureError = e instanceof Error ? e.message : String(e);
      }
    }

    return {
      ...providerInfo,
      azureConfig,
      azureStatus,
      azureError,
      azureResponse,
      azureModel,
    };
  }),
});
