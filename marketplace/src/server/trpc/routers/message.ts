import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { sendMessageSchema } from "@/lib/validators";

export const messageRouter = createTRPCRouter({
  /** Send a message */
  send: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      let conversationId = input.conversationId;

      // Create or get conversation
      if (!conversationId) {
        const listing = await ctx.db.listing.findUnique({
          where: { id: input.listingId },
          select: { userId: true },
        });

        if (!listing) throw new Error("Listing not found");

        const existing = await ctx.db.conversation.findFirst({
          where: {
            listingId: input.listingId,
            buyerId: ctx.session.user.id!,
            sellerId: listing.userId,
          },
        });

        if (existing) {
          conversationId = existing.id;
        } else {
          const conv = await ctx.db.conversation.create({
            data: {
              listingId: input.listingId,
              buyerId: ctx.session.user.id!,
              sellerId: listing.userId,
            },
          });
          conversationId = conv.id;
        }
      }

      const message = await ctx.db.message.create({
        data: {
          conversationId,
          senderId: ctx.session.user.id!,
          receiverId: input.receiverId,
          listingId: input.listingId,
          content: input.content,
        },
      });

      // Update conversation last message time
      await ctx.db.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      return message;
    }),

  /** Get my conversations */
  myConversations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.conversation.findMany({
      where: {
        OR: [
          { buyerId: ctx.session.user.id! },
          { sellerId: ctx.session.user.id! },
        ],
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        listing: {
          select: { id: true, title: true, price: true, images: { take: 1 } },
        },
        buyer: { select: { id: true, name: true, avatar: true } },
        seller: { select: { id: true, name: true, avatar: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: {
          select: {
            messages: {
              where: { receiverId: ctx.session.user.id!, isRead: false },
            },
          },
        },
      },
    });
  }),

  /** Get messages in a conversation */
  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string().cuid(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      // Mark unread messages as read
      await ctx.db.message.updateMany({
        where: {
          conversationId: input.conversationId,
          receiverId: ctx.session.user.id!,
          isRead: false,
        },
        data: { isRead: true },
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      return { messages, nextCursor };
    }),
});
