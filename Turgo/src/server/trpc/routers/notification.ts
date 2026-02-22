import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import {
  registerPushSubscription,
  removePushSubscription,
  getVapidPublicKey,
} from "@/server/services/notification";

export const notificationRouter = createTRPCRouter({
  /** Get all notifications for current user */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        unreadOnly: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.notification.findMany({
        where: {
          userId: ctx.session.user.id!,
          ...(input.unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem!.id;
      }

      return { notifications, nextCursor };
    }),

  /** Get unread notification count */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({
      where: { userId: ctx.session.user.id!, isRead: false },
    });
  }),

  /** Mark notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.update({
        where: { id: input.id, userId: ctx.session.user.id! },
        data: { isRead: true },
      });
      return { success: true };
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: { userId: ctx.session.user.id!, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }),

  /** Delete a notification */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.delete({
        where: { id: input.id, userId: ctx.session.user.id! },
      });
      return { success: true };
    }),

  /** Register push subscription */
  registerPush: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await registerPushSubscription({
        userId: ctx.session.user.id!,
        ...input,
      });
      return { success: true };
    }),

  /** Remove push subscription */
  removePush: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.session.user.id!, input.endpoint);
      return { success: true };
    }),

  /** Get VAPID public key for push registration */
  getVapidKey: protectedProcedure.query(() => {
    return { key: getVapidPublicKey() };
  }),
});
