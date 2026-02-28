/**
 * Socket.IO Server — Real-time messaging for Turgo
 * Handles WebSocket connections for instant messaging,
 * agent notifications, typing indicators, and read receipts.
 *
 * Authentication: JWT from the NextAuth session cookie (or handshake.auth.token)
 * is verified in the io.use() middleware. Only authenticated users may connect.
 *
 * Horizontal Scaling: Uses @socket.io/redis-streams-adapter so multiple
 * server instances share room membership and broadcast events via Redis Streams.
 */

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { decode } from "next-auth/jwt";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import { REDIS_URL } from "@/lib/redis";

let io: SocketIOServer | null = null;

/**
 * Possible NextAuth session-cookie names (v5 "authjs" prefix + legacy "next-auth").
 * Secure variants are used when the site is served over HTTPS.
 */
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

/**
 * Extract the raw JWT string and the cookie name (used as salt for decode)
 * from the Cookie header sent with the Socket.IO handshake.
 */
function extractSessionToken(
  cookieHeader: string | undefined,
): { token: string; salt: string } | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());

  for (const name of SESSION_COOKIE_NAMES) {
    const match = cookies.find((c) => c.startsWith(`${name}=`));
    if (match) {
      const token = decodeURIComponent(match.substring(name.length + 1));
      return { token, salt: name };
    }
  }

  return null;
}

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
export async function initSocketServer(
  httpServer: HTTPServer,
): Promise<SocketIOServer> {
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

  // ── Redis Streams adapter for horizontal scaling ─────────
  try {
    const { default: Redis } = await import("ioredis");
    const redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by the adapter
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await redisClient.connect();
    io.adapter(createAdapter(redisClient));
    console.log("[Socket] Redis Streams adapter connected");
  } catch (err) {
    console.warn(
      "[Socket] Redis adapter unavailable — falling back to in-memory adapter:",
      err instanceof Error ? err.message : err,
    );
  }

  // ── Authentication middleware ────────────────────────────
  // Verifies the NextAuth JWT before allowing a connection.
  // Supports two token sources (in priority order):
  //   1. handshake.auth.token  – explicitly passed by the client
  //   2. Session cookie        – automatically attached by the browser
  io.use(async (socket, next) => {
    try {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
      if (!secret) {
        console.error("[Socket] AUTH_SECRET / NEXTAUTH_SECRET is not set");
        return next(new Error("Server configuration error"));
      }

      let rawToken: string | undefined;
      let salt = "authjs.session-token";

      // 1. Explicit token passed by the client
      if (
        typeof socket.handshake.auth.token === "string" &&
        socket.handshake.auth.token
      ) {
        rawToken = socket.handshake.auth.token;
      }

      // 2. Fall back to session cookie from the handshake headers
      if (!rawToken) {
        const extracted = extractSessionToken(socket.handshake.headers.cookie);
        if (extracted) {
          rawToken = extracted.token;
          salt = extracted.salt;
        }
      }

      if (!rawToken) {
        return next(new Error("Authentication required"));
      }

      const decoded = await decode({ token: rawToken, secret, salt });

      if (!decoded || !decoded.id) {
        return next(new Error("Invalid or expired token"));
      }

      // Attach the verified user ID so handlers never trust client claims
      socket.data.userId = decoded.id as string;
      next();
    } catch (err) {
      console.error("[Socket] Auth middleware error:", err);
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection handler ───────────────────────────────────
  io.on("connection", (socket) => {
    // userId is guaranteed to be set by the auth middleware above
    const userId = socket.data.userId as string;

    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // Join user's personal room for direct notifications
    // (the Redis adapter propagates room membership across instances)
    socket.join(`user:${userId}`);

    // Join conversation rooms
    socket.on("join:conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(
        `[Socket] User ${userId} joined conversation ${conversationId}`,
      );
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

/** Check if a user is currently online (via Socket.IO room membership) */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
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
export function emitNotification(
  userId: string,
  payload: NotificationPayload,
): void {
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
  },
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
  },
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("message:pending-approval", payload);
}

/** Get count of online users (connected to this instance) */
export async function getOnlineUserCount(): Promise<number> {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  const uniqueUsers = new Set(sockets.map((s) => s.data.userId as string));
  return uniqueUsers.size;
}
