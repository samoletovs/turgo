/**
 * Strategy Router — tRPC endpoints for strategy recommendation.
 * Provides market-data-driven strategy recommendations for both
 * selling and buying wizards.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '@/server/trpc';
import {
  recommendSellingStrategy,
  recommendBuyingStrategy,
} from '@/server/services/strategy-recommender';

export const strategyRouter = createTRPCRouter({
  /** Get selling strategy recommendation based on market data */
  recommendSelling: publicProcedure
    .input(
      z.object({
        categoryId: z.string().min(1),
        locationId: z.string().optional(),
        subcategorySlug: z.string().optional(),
        urgency: z.string().min(1),
        price: z.number().positive(),
        minimumPrice: z.number().positive(),
      }),
    )
    .query(async ({ input }) => {
      return recommendSellingStrategy(input);
    }),

  /** Get buying strategy recommendation based on market data */
  recommendBuying: publicProcedure
    .input(
      z.object({
        categoryId: z.string().min(1),
        locationId: z.string().optional(),
        subcategorySlug: z.string().optional(),
        maxBudget: z.number().positive(),
        targetPrice: z.number().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      return recommendBuyingStrategy(input);
    }),
});
