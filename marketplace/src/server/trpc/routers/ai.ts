import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { conciergeMessageSchema } from "@/lib/validators";
import { z } from "zod";

export const aiRouter = createTRPCRouter({
  /** Concierge chat — intent detection and routing */
  concierge: publicProcedure
    .input(conciergeMessageSchema)
    .mutation(async ({ input }) => {
      // AI concierge intent detection (uses ai-dev/ai-free/ai-premium based on env)
      const { message } = input;
      const lowerMessage = message.toLowerCase();

      // Simple rule-based intent detection (replaced by LLM in production)
      let intent: "sell" | "buy" | "support" | "browse" | "other" = "other";
      let response = "";

      if (/sell|pārdod|продать|parduot|müüa/i.test(lowerMessage)) {
        intent = "sell";
        response =
          "I'd love to help you sell! Upload some photos and I'll handle everything — pricing, posting, and finding buyers. Ready to start?";
      } else if (/buy|find|looking|pirkt|meklē|купить|ищу|pirkti|ieškau|osta|otsin/i.test(lowerMessage)) {
        intent = "buy";
        response =
          "I'll find exactly what you need! Describe what you're looking for, your budget, and preferred location. I'll monitor 24/7 and alert you to the best deals.";
      } else if (/help|support|problem|palīdzēt|помощь|pagalba|abi/i.test(lowerMessage)) {
        intent = "support";
        response =
          "I'm here to help! What can I assist you with? I can help with account issues, listing questions, billing, or anything else.";
      } else if (/browse|search|categories|show|skatīt|смотреть|žiūrėti|vaata/i.test(lowerMessage)) {
        intent = "browse";
        response =
          "Let me show you what's available! What category interests you? Or describe what you're looking for in your own words.";
      } else {
        response =
          "Hi! I'm your marketplace concierge. I can help you:\n• **Sell** — Upload photos and I'll handle everything\n• **Buy** — Tell me what you need, I'll find it\n• **Browse** — Explore categories and listings\n\nWhat would you like to do?";
      }

      return {
        intent,
        message: response,
        suggestedActions: [
          { label: "🏷️ Sell something", action: "sell" },
          { label: "🔍 Find something", action: "buy" },
          { label: "📂 Browse categories", action: "browse" },
        ],
      };
    }),

  /** Generate listing description from AI */
  generateDescription: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        category: z.string(),
        condition: z.string(),
        attributes: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Placeholder — in production calls AI service
      return {
        description: `This ${input.condition.toLowerCase()} ${input.title} is in great condition and ready for a new owner. Listed in the ${input.category} category. Contact the seller for more details and to arrange a viewing.`,
        confidence: 0.8,
      };
    }),

  /** Suggest price based on market data */
  suggestPrice: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        title: z.string(),
        condition: z.string(),
        locationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get market data for this category
      const snapshots = await ctx.db.marketSnapshot.findMany({
        where: { categoryId: input.categoryId },
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
      return {
        suggestedPrice: latest.medianPrice ?? latest.avgPrice ?? 0,
        minPrice: latest.minPrice ?? 0,
        maxPrice: latest.maxPrice ?? 0,
        confidence: 0.7,
        reasoning: `Based on ${latest.listingCount} similar listings in this category.`,
        comparableListings: latest.listingCount,
      };
    }),
});
