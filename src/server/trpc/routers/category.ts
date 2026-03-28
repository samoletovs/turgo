import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '@/server/trpc';
import { cachedQuery, CACHE_KEYS, CACHE_TTL } from '@/server/services/cache';

export const categoryRouter = createTRPCRouter({
  /** Get all top-level categories with children (cached 15 min) */
  getAll: publicProcedure.query(async ({ ctx }) => {
    return cachedQuery(CACHE_KEYS.CATEGORIES, CACHE_TTL.CATEGORIES, () =>
      ctx.db.category.findMany({
        where: { parentId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              _count: {
                select: { listings: { where: { status: 'ACTIVE' } } },
              },
            },
          },
          _count: {
            select: { listings: { where: { status: 'ACTIVE' } } },
          },
        },
      }),
    );
  }),

  /** Get a single category by slug with its children and attributes */
  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.category.findUnique({
      where: { slug: input.slug },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { listings: { where: { status: 'ACTIVE' } } },
            },
          },
        },
        attributes: { orderBy: { sortOrder: 'asc' } },
        _count: {
          select: { listings: { where: { status: 'ACTIVE' } } },
        },
      },
    });
  }),

  /** Get category tree (flat list) */
  getTree: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { listings: { where: { status: 'ACTIVE' } } },
        },
      },
    });
  }),
});
