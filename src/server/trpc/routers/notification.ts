import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import {
  registerPushSubscription,
  removePushSubscription,
  getVapidPublicKey,
} from '@/server/services/notification';
import { sendEmail } from '@/server/services/email';

// Restrict destinations because the server sends HTTP requests to these URLs.
const pushEndpoint = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname.endsWith('.notify.windows.com') ||
        url.hostname === 'web.push.apple.com')
    );
  }, 'Unsupported push endpoint');

const pushKey = (length: number) =>
  z
    .string()
    .max(90)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .refine(
      (value) => Buffer.from(value, 'base64url').length === length,
      'Invalid push key length',
    );

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
        orderBy: { createdAt: 'desc' },
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
        endpoint: pushEndpoint,
        p256dh: pushKey(65).refine((value) => Buffer.from(value, 'base64url')[0] === 4),
        auth: pushKey(16),
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
    .input(z.object({ endpoint: z.string().max(2048).url() }))
    .mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.session.user.id!, input.endpoint);
      return { success: true };
    }),

  /** Get VAPID public key for push registration */
  getVapidKey: protectedProcedure.query(() => {
    return { key: getVapidPublicKey() };
  }),

  /** Submit contact form (public — rate limited by IP in email service) */
  submitContact: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        subject: z.string().min(1).max(100),
        message: z.string().min(10).max(5000),
      }),
    )
    .mutation(async ({ input }) => {
      const SUBJECT_MAP: Record<string, string> = {
        general: 'General Inquiry',
        support: 'Support Request',
        billing: 'Billing Question',
        partnership: 'Partnership Inquiry',
        press: 'Press Inquiry',
        feedback: 'Feedback',
      };

      function escapeHtml(s: string): string {
        return s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      const subjectLabel = SUBJECT_MAP[input.subject] || input.subject;
      const safeName = escapeHtml(input.name);
      const safeEmail = escapeHtml(input.email);
      const safeMessage = escapeHtml(input.message);
      const safeSubject = escapeHtml(subjectLabel);

      await sendEmail({
        to: 'support@turgo.io',
        subject: `[Contact] ${subjectLabel} — from ${input.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top; width: 120px;">Name:</td>
                <td style="padding: 8px 0;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Subject:</td>
                <td style="padding: 8px 0;">${safeSubject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Message:</td>
                <td style="padding: 8px 0; white-space: pre-wrap;">${safeMessage}</td>
              </tr>
            </table>
          </div>
        `,
        text: `Contact from ${input.name} (${input.email})\nSubject: ${subjectLabel}\n\n${input.message}`,
      });

      return { ok: true };
    }),
});
