import { initTRPC, TRPCError } from '@trpc/server';
import { type Session } from 'next-auth';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from '@/server/db';
import { rateLimit } from '@/lib/rate-limit';
import type { UserTier } from '@/server/services/ai';

/** Context passed to every tRPC procedure */
export interface TRPCContext {
  db: typeof db;
  session: Session | null;
  headers: Headers;
}

export async function createTRPCContext(opts: {
  headers: Headers;
  session: Session | null;
}): Promise<TRPCContext> {
  return {
    db,
    session: opts.session,
    headers: opts.headers,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** Public procedure — no auth required */
export const publicProcedure = t.procedure;

/** Protected procedure — requires authenticated session */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/** Admin procedure — requires ADMIN or MODERATOR role (read from JWT session) */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const role = (ctx.session.user as { role?: string }).role;
  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// ──────────────────────────────────────────────
// TIER-AWARE PROCEDURES
// ──────────────────────────────────────────────

/** Per-request cache for resolved user tiers (avoids duplicate DB queries within a single request) */
const tierCache = new Map<string, Promise<UserTier>>();

/** Resolve user's subscription tier (cached per-request via middleware reset) */
function resolveUserTier(userId: string, database: typeof db): Promise<UserTier> {
  const existing = tierCache.get(userId);
  if (existing) return existing;

  const promise = (async (): Promise<UserTier> => {
    const subscription = await database.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') return 'free';

    switch (subscription.plan.name) {
      case 'PRO':
        return 'pro';
      case 'BUSINESS':
        return 'business';
      default:
        return 'free';
    }
  })();

  tierCache.set(userId, promise);

  // Clean up after the promise settles to avoid cross-request leaks
  // (Next.js runs each request in its own microtask queue, but belt-and-suspenders)
  void promise.finally(() => {
    setTimeout(() => tierCache.delete(userId), 0);
  });

  return promise;
}

/** Protected procedure with user tier context — for AI-routed operations */
export const tieredProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const userTier = await resolveUserTier(ctx.session.user.id!, ctx.db);

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      userTier,
    },
  });
});

/** Paid-only procedure — requires Pro or Business subscription */
export const paidProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const userTier = await resolveUserTier(ctx.session.user.id!, ctx.db);

  if (userTier === 'free') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This feature requires a Pro or Business subscription. Upgrade at /pricing.',
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      userTier,
    },
  });
});

// ──────────────────────────────────────────────
// RATE-LIMITED PROCEDURE
// ──────────────────────────────────────────────

/**
 * Creates a protected procedure with sliding-window rate limiting.
 * Uses the authenticated user's ID as the rate-limit key.
 *
 * @param opts.max      Max requests in the window (matches RATE_LIMITS shape)
 * @param opts.limit    Alias for max (either works)
 * @param opts.windowMs Window size in milliseconds
 */
export function createRateLimitedProcedure(opts: {
  max?: number;
  limit?: number;
  windowMs: number;
}) {
  const limit = opts.max ?? opts.limit ?? 100;
  return protectedProcedure.use(async ({ ctx, next, path }) => {
    const userId = ctx.session.user.id ?? 'unknown';
    const key = `trpc:${path}:${userId}`;

    const result = await rateLimit({
      key,
      limit,
      windowMs: opts.windowMs,
    });

    if (!result.success) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)}s.`,
      });
    }

    return next();
  });
}
