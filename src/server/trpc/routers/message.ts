import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, createRateLimitedProcedure } from '@/server/trpc';
import { sendMessageSchema } from '@/lib/validators';
import { RATE_LIMITS } from '@/lib/constants';
import { sanitizeHtml } from '@/lib/sanitize';
import { emitMessage, emitReadReceipt, emitMessageReaction } from '@/server/socket';
import { MESSAGE_REACTIONS, parseMessageReactions } from '@/lib/message-reactions';
import {
  processAutoRespond,
  processAutoNegotiate,
  approveAgentMessage,
  rejectAgentMessage,
} from '@/server/services/messaging';
import {
  translateAndStoreMessage,
  translateMessageOnDemand,
  detectLanguage,
} from '@/server/services/translation';
import { notifyNewMessage, notifyNegotiationEvent } from '@/server/services/notification';
import type { Locale } from '@/lib/constants';

export const messageRouter = createTRPCRouter({
  /** Send a message — with agent auto-respond/auto-negotiate integration */
  send: createRateLimitedProcedure(RATE_LIMITS.MESSAGE_SEND)
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Sanitize user-generated message content
      const sanitizedContent = sanitizeHtml(input.content);
      const sanitizedInput = { ...input, content: sanitizedContent };

      let conversationId = sanitizedInput.conversationId;
      let _sellerId: string | undefined;

      // Create or get conversation
      if (!conversationId) {
        const listing = await ctx.db.listing.findUnique({
          where: { id: input.listingId },
          select: { userId: true },
        });

        if (!listing) throw new Error('Listing not found');
        _sellerId = listing.userId;

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

      // Detect language
      const originalLanguage = detectLanguage(sanitizedContent);

      const message = await ctx.db.message.create({
        data: {
          conversationId,
          senderId: ctx.session.user.id!,
          receiverId: input.receiverId,
          listingId: input.listingId,
          content: sanitizedContent,
          messageType: 'TEXT',
          originalLanguage,
        },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      });

      // Update conversation last message time
      await ctx.db.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Emit real-time message via Socket.IO
      emitMessage({
        id: message.id,
        conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        messageType: message.messageType,
        isAgentMessage: false,
        originalLanguage,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender
          ? {
              id: message.sender.id,
              name: message.sender.name ?? 'User',
              avatar: message.sender.avatar ?? undefined,
            }
          : undefined,
      });

      // Send notification to receiver
      const receiver = await ctx.db.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true },
      });
      if (receiver) {
        const listing = await ctx.db.listing.findUnique({
          where: { id: input.listingId },
          select: { title: true },
        });
        notifyNewMessage({
          receiverId: input.receiverId,
          senderId: ctx.session.user.id!,
          senderName: message.sender?.name ?? 'Someone',
          conversationId,
          listingTitle: listing?.title ?? 'Listing',
          messagePreview: sanitizedContent,
          isAgentMessage: false,
        }).catch(console.error);
      }

      // Auto-translate for Pro/Business users (non-blocking)
      translateAndStoreMessage(message.id, ctx.session.user.id!).catch(console.error);

      // Process auto-respond (selling agent)
      processAutoRespond({
        conversationId,
        messageContent: sanitizedContent,
        senderId: ctx.session.user.id!,
        receiverId: input.receiverId,
        listingId: input.listingId,
      }).catch(console.error);

      // Process auto-negotiate (selling agent)
      processAutoNegotiate({
        conversationId,
        messageContent: sanitizedContent,
        senderId: ctx.session.user.id!,
        receiverId: input.receiverId,
        listingId: input.listingId,
      }).catch(console.error);

      return message;
    }),

  /** Send an offer message explicitly */
  sendOffer: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        receiverId: z.string().cuid(),
        listingId: z.string().cuid(),
        offerPrice: z.number().positive(),
        message: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const content = input.message || `I'd like to offer €${input.offerPrice} for this item.`;

      const message = await ctx.db.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: ctx.session.user.id!,
          receiverId: input.receiverId,
          listingId: input.listingId,
          content,
          messageType: 'OFFER',
          metadata: { offerPrice: input.offerPrice },
          originalLanguage: detectLanguage(content),
        },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      });

      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      });

      emitMessage({
        id: message.id,
        conversationId: input.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        messageType: 'OFFER',
        isAgentMessage: false,
        metadata: { offerPrice: input.offerPrice },
        createdAt: message.createdAt.toISOString(),
        sender: message.sender
          ? {
              id: message.sender.id,
              name: message.sender.name ?? 'User',
              avatar: message.sender.avatar ?? undefined,
            }
          : undefined,
      });

      // Notify seller
      const listing = await ctx.db.listing.findUnique({
        where: { id: input.listingId },
        select: { title: true },
      });
      notifyNegotiationEvent({
        userId: input.receiverId,
        type: 'OFFER_RECEIVED',
        listingTitle: listing?.title ?? 'Listing',
        amount: input.offerPrice,
        conversationId: input.conversationId,
      }).catch(console.error);

      // Auto-negotiate if enabled
      processAutoNegotiate({
        conversationId: input.conversationId,
        messageContent: content,
        senderId: ctx.session.user.id!,
        receiverId: input.receiverId,
        listingId: input.listingId,
      }).catch(console.error);

      return message;
    }),

  /** Approve an agent's pending message */
  approveMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().cuid(),
        editedContent: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await approveAgentMessage({
        messageId: input.messageId,
        userId: ctx.session.user.id!,
        editedContent: input.editedContent,
      });
      return { success: true };
    }),

  /** Reject an agent's pending message */
  rejectMessage: protectedProcedure
    .input(z.object({ messageId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await rejectAgentMessage(input.messageId, ctx.session.user.id!);
      return { success: true };
    }),

  /** Get pending agent messages awaiting approval */
  getPendingMessages: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.message.findMany({
      where: {
        senderId: ctx.session.user.id!,
        requiresApproval: true,
        approvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          include: {
            listing: {
              select: { id: true, title: true, price: true },
            },
          },
        },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    });
  }),

  /** Translate a message on-demand */
  translate: protectedProcedure
    .input(
      z.object({
        messageId: z.string().cuid(),
        targetLocale: z.enum(['en', 'lv', 'ru', 'lt', 'et']),
      }),
    )
    .mutation(async ({ ctx: _ctx, input }) => {
      const translation = await translateMessageOnDemand(
        input.messageId,
        input.targetLocale as Locale,
      );
      return { translation, locale: input.targetLocale };
    }),

  /** Get my conversations */
  myConversations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.conversation.findMany({
      where: {
        OR: [{ buyerId: ctx.session.user.id! }, { sellerId: ctx.session.user.id! }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            currency: true,
            managedByAgent: true,
            images: { take: 1, select: { url: true, thumbnailUrl: true } },
          },
        },
        buyer: { select: { id: true, name: true, avatar: true } },
        seller: { select: { id: true, name: true, avatar: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            senderId: true,
            isRead: true,
            isAgentMessage: true,
            messageType: true,
          },
        },
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
    .input(
      z.object({
        conversationId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user is participant
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.conversationId },
        select: { buyerId: true, sellerId: true },
      });

      if (
        !conversation ||
        (conversation.buyerId !== ctx.session.user.id &&
          conversation.sellerId !== ctx.session.user.id)
      ) {
        throw new Error('Conversation not found');
      }

      const messages = await ctx.db.message.findMany({
        where: {
          conversationId: input.conversationId,
          // Exclude unapproved agent messages that aren't ours
          OR: [
            { requiresApproval: false },
            { approvedAt: { not: null } },
            { senderId: ctx.session.user.id! },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      });

      // Mark unread messages as read
      const readResult = await ctx.db.message.updateMany({
        where: {
          conversationId: input.conversationId,
          receiverId: ctx.session.user.id!,
          isRead: false,
        },
        data: { isRead: true },
      });

      const lastReceivedMessage = messages.find(
        (message) => message.receiverId === ctx.session.user.id,
      );
      if (readResult.count > 0 && lastReceivedMessage) {
        emitReadReceipt(input.conversationId, ctx.session.user.id!, lastReceivedMessage.id);
      }

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      return { messages, nextCursor };
    }),

  /** Get conversation details */
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              price: true,
              currency: true,
              negotiable: true,
              managedByAgent: true,
              sellingAgent: {
                select: {
                  id: true,
                  autoRespond: true,
                  autoNegotiate: true,
                  currentPrice: true,
                  minimumPrice: true,
                  status: true,
                },
              },
              images: { take: 1, select: { url: true, thumbnailUrl: true } },
            },
          },
          buyer: { select: { id: true, name: true, avatar: true } },
          seller: { select: { id: true, name: true, avatar: true } },
        },
      });

      if (!conversation) throw new Error('Conversation not found');

      if (
        conversation.buyerId !== ctx.session.user.id &&
        conversation.sellerId !== ctx.session.user.id
      ) {
        throw new Error('Unauthorized');
      }

      return conversation;
    }),

  /** Mark messages in a conversation as read and notify sender via socket */
  markAsRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        lastMessageId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the caller is a conversation participant
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.conversationId },
        select: { buyerId: true, sellerId: true },
      });

      if (
        !conversation ||
        (conversation.buyerId !== ctx.session.user.id &&
          conversation.sellerId !== ctx.session.user.id)
      ) {
        throw new Error('Conversation not found');
      }

      const lastMessage = await ctx.db.message.findFirst({
        where: {
          id: input.lastMessageId,
          conversationId: input.conversationId,
          receiverId: ctx.session.user.id!,
        },
        select: { createdAt: true },
      });

      if (!lastMessage) {
        throw new Error('Message not found');
      }

      // Mark unread received messages up to the acknowledged message as read in the DB
      await ctx.db.message.updateMany({
        where: {
          conversationId: input.conversationId,
          receiverId: ctx.session.user.id!,
          isRead: false,
          createdAt: { lte: lastMessage.createdAt },
        },
        data: { isRead: true },
      });

      // Broadcast real-time read receipt so the sender's UI updates immediately
      emitReadReceipt(input.conversationId, ctx.session.user.id!, input.lastMessageId);

      return { success: true };
    }),

  /** Get unread message count across all conversations */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.message.count({
      where: {
        receiverId: ctx.session.user.id!,
        isRead: false,
      },
    });
    return count;
  }),

  /** Toggle a reaction on a message */
  react: protectedProcedure
    .input(
      z.object({
        messageId: z.string().cuid(),
        emoji: z.enum(MESSAGE_REACTIONS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
        select: {
          id: true,
          conversationId: true,
          metadata: true,
          conversation: {
            select: { buyerId: true, sellerId: true },
          },
        },
      });

      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const isParticipant =
        message.conversation.buyerId === ctx.session.user.id ||
        message.conversation.sellerId === ctx.session.user.id;

      if (!isParticipant) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
      }

      const metadata =
        message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
          ? (message.metadata as Record<string, unknown>)
          : {};
      const reactions = parseMessageReactions(metadata.reactions);

      const userId = ctx.session.user.id!;
      const currentUsers = reactions[input.emoji] ?? [];
      const hasReacted = currentUsers.includes(userId);

      const nextUsers = hasReacted
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId];

      if (nextUsers.length > 0) {
        reactions[input.emoji] = nextUsers;
      } else {
        delete reactions[input.emoji];
      }

      const nextMetadata: Record<string, unknown> = { ...metadata };
      if (Object.keys(reactions).length > 0) {
        nextMetadata.reactions = reactions;
      } else {
        delete nextMetadata.reactions;
      }

      const updated = await ctx.db.message.update({
        where: { id: input.messageId },
        data: {
          metadata:
            Object.keys(nextMetadata).length > 0
              ? (nextMetadata as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
        select: {
          id: true,
          conversationId: true,
          metadata: true,
        },
      });

      const updatedMetadata =
        updated.metadata && typeof updated.metadata === 'object' && !Array.isArray(updated.metadata)
          ? (updated.metadata as Record<string, unknown>)
          : {};
      const updatedReactions = parseMessageReactions(updatedMetadata.reactions);

      emitMessageReaction({
        conversationId: message.conversationId,
        messageId: message.id,
        reactions: updatedReactions,
      });

      return {
        id: updated.id,
        conversationId: updated.conversationId,
        reactions: updatedReactions,
      };
    }),
});
