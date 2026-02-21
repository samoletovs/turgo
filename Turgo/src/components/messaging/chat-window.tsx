"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Send, Bot, Loader2, DollarSign, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./message-bubble";
import { NegotiationFlow } from "./negotiation-flow";
import { useConversationSocket } from "@/lib/socket-client";
import { trpc } from "@/lib/trpc/client";
import type { SocketMessage } from "@/lib/socket-client";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface ConversationData {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    price: number;
    currency: string;
    negotiable: boolean;
    managedByAgent: boolean;
    sellingAgent?: {
      id: string;
      autoRespond: boolean;
      autoNegotiate: boolean;
      currentPrice: number;
      minimumPrice: number;
      status: string;
    } | null;
    images: { url: string; thumbnailUrl: string | null }[];
  };
  buyer: { id: string; name: string | null; avatar: string | null };
  seller: { id: string; name: string | null; avatar: string | null };
}

interface ChatWindowProps {
  conversationId: string;
  locale?: string;
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ChatWindow({ conversationId, locale = "en" }: ChatWindowProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [input, setInput] = useState("");
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // tRPC queries
  const conversationQuery = trpc.message.getConversation.useQuery(
    { conversationId },
    { enabled: !!conversationId }
  );
  const messagesQuery = trpc.message.getMessages.useQuery(
    { conversationId, limit: 50 },
    { enabled: !!conversationId }
  );
  const sendMutation = trpc.message.send.useMutation();
  const sendOfferMutation = trpc.message.sendOffer.useMutation();
  const approveMutation = trpc.message.approveMessage.useMutation();
  const rejectMutation = trpc.message.rejectMessage.useMutation();
  const translateMutation = trpc.message.translate.useMutation();
  const utils = trpc.useUtils();

  // Socket.IO real-time messages
  const { newMessages, typingUsers, sendTyping, sendReadReceipt } =
    useConversationSocket(conversationId);

  const conversation = conversationQuery.data as ConversationData | undefined;
  const otherUser =
    conversation && userId === conversation.buyerId
      ? conversation.seller
      : conversation?.buyer;

  const isAgentManaged = conversation?.listing?.managedByAgent;
  const sellingAgent = conversation?.listing?.sellingAgent;

  // Combine DB messages with real-time socket messages
  const allMessages = useMemo(() => {
    const dbMsgs = messagesQuery.data?.messages ?? [];
    return [
      ...dbMsgs.slice().reverse(),
      ...newMessages.map((m: SocketMessage) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        translatedContent: m.translatedContent ?? null,
        metadata: m.metadata ?? null,
        isRead: false,
        requiresApproval: m.requiresApproval ?? false,
        approvedAt: null,
        originalLanguage: m.originalLanguage ?? null,
        listingId: null,
      })),
    ];
  }, [messagesQuery.data?.messages, newMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages.length, showScrollButton]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  // Handle scroll for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  }, []);

  // Mark messages as read
  useEffect(() => {
    const lastMessage = allMessages[allMessages.length - 1];
    if (lastMessage && lastMessage.senderId !== userId) {
      sendReadReceipt(lastMessage.id);
    }
  }, [allMessages, userId, sendReadReceipt]);

  // ── HANDLERS ─────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || !conversation || !userId) return;

    const receiverId =
      userId === conversation.buyerId
        ? conversation.sellerId
        : conversation.buyerId;

    try {
      await sendMutation.mutateAsync({
        conversationId,
        receiverId,
        listingId: conversation.listingId,
        content: input.trim(),
      });
      setInput("");
      inputRef.current?.focus();
      utils.message.getMessages.invalidate({ conversationId });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleSendOffer = async () => {
    if (!offerAmount || !conversation || !userId) return;

    const price = parseFloat(offerAmount);
    if (isNaN(price) || price <= 0) return;

    const receiverId =
      userId === conversation.buyerId
        ? conversation.sellerId
        : conversation.buyerId;

    try {
      await sendOfferMutation.mutateAsync({
        conversationId,
        receiverId,
        listingId: conversation.listingId,
        offerPrice: price,
      });
      setOfferAmount("");
      setShowOfferInput(false);
      utils.message.getMessages.invalidate({ conversationId });
    } catch (error) {
      console.error("Failed to send offer:", error);
    }
  };

  const handleApprove = async (messageId: string, editedContent?: string) => {
    try {
      await approveMutation.mutateAsync({ messageId, editedContent });
      utils.message.getMessages.invalidate({ conversationId });
    } catch (error) {
      console.error("Failed to approve message:", error);
    }
  };

  const handleReject = async (messageId: string) => {
    try {
      await rejectMutation.mutateAsync({ messageId });
      utils.message.getMessages.invalidate({ conversationId });
    } catch (error) {
      console.error("Failed to reject message:", error);
    }
  };

  const handleTranslate = async (messageId: string, targetLocale: string) => {
    try {
      await translateMutation.mutateAsync({
        messageId,
        targetLocale: targetLocale as "en" | "lv" | "ru" | "lt" | "et",
      });
      utils.message.getMessages.invalidate({ conversationId });
    } catch (error) {
      console.error("Failed to translate:", error);
    }
  };

  // Typing indicator
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (value: string) => {
    setInput(value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  // ── NEGOTIATION HISTORY ──────────────────

  const negotiationMessages = allMessages.filter(
    (m) =>
      m.messageType === "OFFER" ||
      m.messageType === "COUNTER_OFFER" ||
      m.messageType === "ACCEPTANCE" ||
      m.messageType === "REJECTION"
  );

  const hasActiveNegotiation =
    negotiationMessages.length > 0 &&
    !negotiationMessages.some(
      (m) => m.messageType === "ACCEPTANCE" || m.messageType === "REJECTION"
    );

  // ── LOADING STATES ───────────────────────

  if (conversationQuery.isLoading || messagesQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Conversation not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">
              {otherUser?.name ?? "User"}
            </h3>
            {isAgentManaged && (
              <Badge variant="secondary" className="gap-0.5 text-[10px]">
                <Bot className="h-3 w-3" />
                Agent Managed
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Re: {conversation.listing.title} —{" "}
            {conversation.listing.currency === "EUR" ? "€" : ""}
            {conversation.listing.price}
          </p>
        </div>

        {/* Listing image */}
        {conversation.listing.images[0] && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={
              conversation.listing.images[0].thumbnailUrl ||
              conversation.listing.images[0].url
            }
            alt={conversation.listing.title}
            className="h-10 w-10 rounded-lg object-cover"
          />
        )}
      </div>

      {/* Negotiation Flow (if active) */}
      {hasActiveNegotiation && (
        <NegotiationFlow
          messages={negotiationMessages.map((m) => ({
            id: m.id,
            messageType: m.messageType,
            isOwn: m.senderId === userId,
            isAgentMessage: m.isAgentMessage,
            metadata: m.metadata as Record<string, unknown> | undefined,
            createdAt: m.createdAt,
          }))}
          listingPrice={conversation.listing.price}
          currency={conversation.listing.currency}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative"
      >
        {/* Auto-respond / negotiate indicators */}
        {isAgentManaged && sellingAgent && sellingAgent.status === "ACTIVE" && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            <span>
              AI agent is{" "}
              {sellingAgent.autoRespond && sellingAgent.autoNegotiate
                ? "auto-responding and negotiating"
                : sellingAgent.autoRespond
                  ? "auto-responding"
                  : sellingAgent.autoNegotiate
                    ? "auto-negotiating"
                    : "monitoring"}{" "}
              for this listing
            </span>
          </div>
        )}

        {allMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            id={msg.id}
            content={msg.content}
            messageType={msg.messageType}
            isOwn={msg.senderId === userId}
            isAgentMessage={msg.isAgentMessage}
            senderName={
              msg.senderId === userId ? "You" : (otherUser?.name ?? "User")
            }
            createdAt={msg.createdAt}
            isRead={msg.isRead}
            metadata={msg.metadata as Record<string, unknown> | undefined}
            translatedContent={
              msg.translatedContent as Record<string, string> | undefined
            }
            originalLanguage={msg.originalLanguage ?? undefined}
            requiresApproval={msg.requiresApproval}
            approvedAt={msg.approvedAt}
            locale={locale}
            onApprove={handleApprove}
            onReject={handleReject}
            onTranslate={handleTranslate}
          />
        ))}

        {/* Typing indicator */}
        {Array.from(typingUsers.entries())
          .filter(([uid]) => uid !== userId)
          .map(([uid]) => (
            <div key={uid} className="flex gap-2">
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() =>
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="absolute bottom-24 right-6 rounded-full bg-background border shadow-md p-2 hover:bg-muted transition-colors z-10"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* Offer input */}
      {showOfferInput && (
        <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Enter offer amount (€)"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            className="flex-1"
            min={1}
            step={1}
          />
          <Button size="sm" onClick={handleSendOffer} disabled={!offerAmount}>
            Send Offer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowOfferInput(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          {/* Make offer button (if listing is negotiable) */}
          {conversation.listing.negotiable && !showOfferInput && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0"
              onClick={() => setShowOfferInput(true)}
              title="Make an offer"
            >
              <DollarSign className="h-4 w-4" />
            </Button>
          )}

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message..."
            disabled={sendMutation.isPending}
            className="rounded-full text-sm"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sendMutation.isPending}
            className="shrink-0 rounded-full"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
