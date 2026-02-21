import { initTRPC, TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db";
import type { UserTier } from "@/server/services/ai";

/** Context passed to every tRPC procedure */
export interface TRPCContext {
  db: typeof db;
  session: Session | null;
}

export async function createTRPCContext(opts: {
  headers: Headers;
  session: Session | null;
}): Promise<TRPCContext> {
  return {
    db,
    session: opts.session,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
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
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/** Admin procedure — requires ADMIN or MODERATOR role */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
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

/** Resolve user's subscription tier */
async function resolveUserTier(
  userId: string,
  database: typeof db
): Promise<UserTier> {
  const subscription = await database.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription || subscription.status !== "ACTIVE") return "free";

  switch (subscription.plan.name) {
    case "PRO":
      return "pro";
    case "BUSINESS":
      return "business";
    default:
      return "free";
  }
}

/** Protected procedure with user tier context — for AI-routed operations */
export const tieredProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
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
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const userTier = await resolveUserTier(ctx.session.user.id!, ctx.db);

  if (userTier === "free") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires a Pro or Business subscription. Upgrade at /pricing.",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      userTier,
    },
  });
});
