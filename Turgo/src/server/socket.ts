/**
 * Socket.IO Server — Real-time messaging for Turgo
 * Handles WebSocket connections for instant messaging,
 * agent notifications, typing indicators, and read receipts.
 */

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

/** User ID → Set of socket IDs */
const userSockets = new Map<string, Set<string>>();

export interface SocketMessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  isAgentMessage: boolean;
  metadata?: Record<string, unknown>;
  translatedContent?: Record<string, string>;
  originalLanguage?: string;
  requiresApproval?: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadReceiptPayload {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Initialize Socket.IO server */
export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId as string;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Register user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Join conversation rooms
    socket.on("join:conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] User ${userId} joined conversation ${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle typing indicators
    socket.on("typing", (payload: TypingPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("typing", {
        conversationId: payload.conversationId,
        userId,
        isTyping: payload.isTyping,
      });
    });

    // Handle read receipts
    socket.on("read:receipt", (payload: ReadReceiptPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("read:receipt", {
        conversationId: payload.conversationId,
        userId,
        lastReadMessageId: payload.lastReadMessageId,
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      console.log(`[Socket] User ${userId} disconnected`);
    });
  });

  console.log("[Socket] Socket.IO server initialized");
  return io;
}

/** Get the Socket.IO server instance */
export function getIO(): SocketIOServer | null {
  return io;
}

/** Check if a user is currently online */
export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

/** Emit a new message to conversation participants */
export function emitMessage(payload: SocketMessagePayload): void {
  if (!io) return;

  // Emit to the conversation room
  io.to(`conversation:${payload.conversationId}`).emit("message:new", payload);

  // Also emit to receiver's personal room for notification badge
  io.to(`user:${payload.receiverId}`).emit("message:notification", {
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    preview: payload.content.slice(0, 100),
    isAgentMessage: payload.isAgentMessage,
    messageType: payload.messageType,
  });
}

/** Emit a notification to a specific user */
export function emitNotification(userId: string, payload: NotificationPayload): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification", payload);
}

/** Emit agent action to the agent owner */
export function emitAgentAction(
  userId: string,
  payload: {
    agentId: string;
    agentType: "SELLING" | "BUYING";
    actionType: string;
    description: string;
    metadata?: Record<string, unknown>;
    requiresApproval?: boolean;
  }
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("agent:action", payload);
}

/** Emit a message that requires user approval before sending */
export function emitPendingApproval(
  userId: string,
  payload: {
    messageId: string;
    conversationId: string;
    content: string;
    messageType: string;
    agentType: "SELLING" | "BUYING";
    metadata?: Record<string, unknown>;
  }
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("message:pending-approval", payload);
}

/** Get count of online users */
export function getOnlineUserCount(): number {
  return userSockets.size;
}
