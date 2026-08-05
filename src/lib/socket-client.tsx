/**
 * Socket.IO Client Hook — React integration for real-time messaging
 */

'use client';

import { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface SocketMessage {
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

export interface MessageNotification {
  conversationId: string;
  senderId: string;
  preview: string;
  isAgentMessage: boolean;
  messageType: string;
}

export interface PendingApproval {
  messageId: string;
  conversationId: string;
  content: string;
  messageType: string;
  agentType: 'SELLING' | 'BUYING';
  metadata?: Record<string, unknown>;
}

export interface AgentActionEvent {
  agentId: string;
  agentType: 'SELLING' | 'BUYING';
  actionType: string;
  description: string;
  metadata?: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadReceiptEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}

// ──────────────────────────────────────────────
// SOCKET CONTEXT
// ──────────────────────────────────────────────

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  pendingApprovals: PendingApproval[];
  notifications: NotificationEvent[];
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  sendReadReceipt: (conversationId: string, messageId: string) => void;
  clearPendingApproval: (messageId: string) => void;
  clearNotification: (id: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  pendingApprovals: [],
  notifications: [],
  joinConversation: () => {},
  leaveConversation: () => {},
  sendTyping: () => {},
  sendReadReceipt: () => {},
  clearPendingApproval: () => {},
  clearNotification: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

// ──────────────────────────────────────────────
// SOCKET PROVIDER
// ──────────────────────────────────────────────

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
      path: '/api/socketio',
      // Auth is handled server-side by verifying the NextAuth session cookie
      // which the browser sends automatically with the handshake request.
      // Do NOT pass userId here — it would be unverified and spoofable.
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setSocketState(socket);
      console.log('[Socket] Connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    });

    // New message notification (badge counter)
    socket.on('message:notification', (_notification: MessageNotification) => {
      setUnreadCount((c) => c + 1);
    });

    // Agent pending approval
    socket.on('message:pending-approval', (approval: PendingApproval) => {
      setPendingApprovals((prev) => [...prev, approval]);
    });

    // General notifications
    socket.on('notification', (notification: NotificationEvent) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
  }, [session?.user?.id]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join:conversation', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave:conversation', conversationId);
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const sendReadReceipt = useCallback((conversationId: string, messageId: string) => {
    socketRef.current?.emit('read:receipt', {
      conversationId,
      lastReadMessageId: messageId,
    });
  }, []);

  const clearPendingApproval = useCallback((messageId: string) => {
    setPendingApprovals((prev) => prev.filter((p) => p.messageId !== messageId));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketState,
        isConnected,
        unreadCount,
        pendingApprovals,
        notifications,
        joinConversation,
        leaveConversation,
        sendTyping,
        sendReadReceipt,
        clearPendingApproval,
        clearNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// ──────────────────────────────────────────────
// CONVERSATION HOOK
// ──────────────────────────────────────────────

/**
 * Hook for real-time messages within a specific conversation.
 * Joins/leaves the conversation room, listens for new messages,
 * typing indicators, and read receipts.
 */
export function useConversationSocket(conversationId: string) {
  const { socket, joinConversation, leaveConversation, sendTyping, sendReadReceipt } = useSocket();
  const [newMessages, setNewMessages] = useState<SocketMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map());
  const [readReceipts, setReadReceipts] = useState<Map<string, string>>(new Map());
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!socket || !conversationId) return;

    joinConversation(conversationId);
    const currentTimeouts = typingTimeouts.current;

    const handleNewMessage = (message: SocketMessage) => {
      if (message.conversationId === conversationId) {
        setNewMessages((prev) => [...prev, message]);
      }
    };

    const handleTyping = (event: TypingEvent) => {
      if (event.conversationId === conversationId) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (event.isTyping) {
            next.set(event.userId, true);
            // Auto-clear typing after 5 seconds
            const existing = typingTimeouts.current.get(event.userId);
            if (existing) clearTimeout(existing);
            typingTimeouts.current.set(
              event.userId,
              setTimeout(() => {
                setTypingUsers((p) => {
                  const n = new Map(p);
                  n.delete(event.userId);
                  return n;
                });
              }, 5000),
            );
          } else {
            next.delete(event.userId);
          }
          return next;
        });
      }
    };

    const handleReadReceipt = (event: ReadReceiptEvent) => {
      if (event.conversationId === conversationId) {
        setReadReceipts((prev) => {
          const next = new Map(prev);
          next.set(event.userId, event.lastReadMessageId);
          return next;
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('read:receipt', handleReadReceipt);

    return () => {
      leaveConversation(conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('read:receipt', handleReadReceipt);
      // Clear typing timeouts
      currentTimeouts.forEach((t) => clearTimeout(t));
      currentTimeouts.clear();
    };
  }, [socket, conversationId, joinConversation, leaveConversation]);

  const clearMessages = useCallback(() => setNewMessages([]), []);
  const sendConversationTyping = useCallback(
    (isTyping: boolean) => sendTyping(conversationId, isTyping),
    [conversationId, sendTyping],
  );
  const sendConversationReadReceipt = useCallback(
    (messageId: string) => sendReadReceipt(conversationId, messageId),
    [conversationId, sendReadReceipt],
  );

  return {
    newMessages,
    typingUsers,
    readReceipts,
    clearMessages,
    sendTyping: sendConversationTyping,
    sendReadReceipt: sendConversationReadReceipt,
  };
}
