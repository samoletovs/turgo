/**
 * Messaging Service — Agent-integrated messaging with auto-respond, auto-negotiate
 * Bridges messages between users and AI agents with approval flows
 */

import { db } from "@/server/db";
import type { Prisma, MessageType } from "@prisma/client";
import { generateAutoResponse, evaluateOffer } from "./agent-selling";
import {
  emitMessage,
  emitPendingApproval,
  emitAgentAction,
} from "@/server/socket";
import type { SocketMessagePayload } from "@/server/socket";

// ──────────────────────────────────────────────
// AVAILABILITY DETECTION
// ──────────────────────────────────────────────

const AVAILABILITY_PATTERNS = [
  // English
  /is\s+(?:this|it)\s+(?:still\s+)?available/i,
  /still\s+(?:available|for\s+sale|selling)/i,
  /are\s+you\s+still\s+selling/i,
  /can\s+i\s+(?:buy|purchase|get)\s+(?:this|it)/i,
  /is\s+(?:this|the\s+item)\s+(?:still\s+)?(?:for\s+sale|listed)/i,
  // Latvian
  /vai\s+(?:vēl|joprojām)\s+(?:ir|pieejams|aktuāls|pārdod)/i,
  /vai\s+šis\s+(?:ir|vēl)\s+(?:pieejams|aktuāls)/i,
  // Russian
  /(?:ещё|еще)\s+(?:актуально|продаёте|продаете|есть)/i,
  /(?:это|товар)\s+(?:ещё|еще)\s+(?:продаётся|продается|доступ)/i,
  /актуально\s*\?/i,
  // Lithuanian
  /ar\s+(?:dar|vis\s+dar)\s+(?:parduodate|aktualu|turite)/i,
  /ar\s+(?:šis|tai)\s+(?:dar\s+)?(?:pardavinėjama|aktualu)/i,
  // Estonian
  /kas\s+(?:see|on)\s+(?:veel|ikka)\s+(?:müügis|saadaval|aktuaalne)/i,
  /kas\s+(?:veel|ikka\s+veel)\s+müüte/i,
];

/** Detect if message is asking about availability */
export function isAvailabilityQuestion(message: string): boolean {
  return AVAILABILITY_PATTERNS.some((pattern) => pattern.test(message));
}

// ──────────────────────────────────────────────
// OFFER DETECTION
// ──────────────────────────────────────────────

const OFFER_PATTERNS = [
  // English
  /(?:i(?:'ll|'d)?|would|can|will)\s+(?:offer|pay|give|do)\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
  /(?:how\s+about|what\s+about|would\s+you\s+take|would\s+you\s+accept)\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
  /(?:€|EUR?)\s*(\d+(?:[.,]\d+)?)\s*(?:\?|ok|okay|good|deal|final)/i,
  // Latvian
  /(?:piedāvāju|varu\s+piedāvāt|samaksāšu)\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
  // Russian
  /(?:предлагаю|дам|заплачу|готов[а]?\s+(?:дать|заплатить))\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
  // Lithuanian
  /(?:siūlau|galiu\s+pasiūlyti|mokėčiau)\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
  // Estonian
  /(?:pakun|pakuksin|maksaks?in)\s+(?:€|EUR?)?\s*(\d+(?:[.,]\d+)?)/i,
];

/** Extract offer amount from message, if any */
export function extractOfferAmount(message: string): number | null {
  for (const pattern of OFFER_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1].replace(",", "."));
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// AUTO-RESPOND
// ──────────────────────────────────────────────

/**
 * Process incoming message for auto-response by selling agent.
 * Returns true if the agent handled the message.
 */
export async function processAutoRespond(params: {
  conversationId: string;
  messageContent: string;
  senderId: string;
  receiverId: string;
  listingId: string;
}): Promise<boolean> {
  const { conversationId, messageContent, senderId, receiverId, listingId } =
    params;

  // Check if listing has a selling agent with autoRespond enabled
  const sellingAgent = await db.sellingAgent.findFirst({
    where: {
      listingId,
      status: "ACTIVE",
      autoRespond: true,
      userId: receiverId, // Agent belongs to the message receiver (seller)
    },
    include: {
      listing: {
        select: { title: true, description: true, price: true, status: true },
      },
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (!sellingAgent) return false;

  // Check for availability question
  if (isAvailabilityQuestion(messageContent)) {
    const isAvailable = sellingAgent.listing.status === "ACTIVE";
    const response = isAvailable
      ? `Yes, this item is still available! The current price is €${sellingAgent.listing.price}. Feel free to ask any questions or make an offer.`
      : `Sorry, this item is no longer available.`;

    await sendAgentMessage({
      conversationId,
      senderId: receiverId,
      receiverId: senderId,
      listingId,
      content: response,
      messageType: "AUTO_RESPONSE",
      isAgentMessage: true,
      requiresApproval: false,
      agentId: sellingAgent.id,
      agentType: "SELLING",
      senderInfo: sellingAgent.user,
    });

    // Log agent action
    await db.agentAction.create({
      data: {
        sellingAgentId: sellingAgent.id,
        agentType: "SELLING",
        actionType: "AUTO_RESPOND",
        description: `Auto-responded to availability question: "${messageContent.slice(0, 100)}"`,
        metadata: { response, questionType: "availability" },
      },
    });

    // Update inquiry count
    await db.sellingAgent.update({
      where: { id: sellingAgent.id },
      data: { totalInquiries: { increment: 1 } },
    });

    return true;
  }

  // General auto-response using AI
  const aiResponse = await generateAutoResponse(
    messageContent,
    sellingAgent.listing.title,
    sellingAgent.listing.description,
  );

  if (
    aiResponse &&
    aiResponse !== "null" &&
    !aiResponse.includes("[AI Mock]")
  ) {
    await sendAgentMessage({
      conversationId,
      senderId: receiverId,
      receiverId: senderId,
      listingId,
      content: aiResponse,
      messageType: "AUTO_RESPONSE",
      isAgentMessage: true,
      requiresApproval: false,
      agentId: sellingAgent.id,
      agentType: "SELLING",
      senderInfo: sellingAgent.user,
    });

    await db.agentAction.create({
      data: {
        sellingAgentId: sellingAgent.id,
        agentType: "SELLING",
        actionType: "AUTO_RESPOND",
        description: `Auto-responded to question: "${messageContent.slice(0, 100)}"`,
        metadata: { response: aiResponse, questionType: "general" },
      },
    });

    return true;
  }

  return false;
}

// ──────────────────────────────────────────────
// AUTO-NEGOTIATE
// ──────────────────────────────────────────────

/**
 * Process incoming message for auto-negotiation by selling agent.
 * Detects offers, evaluates them, and sends counter-offers or accepts/rejects.
 */
export async function processAutoNegotiate(params: {
  conversationId: string;
  messageContent: string;
  senderId: string;
  receiverId: string;
  listingId: string;
}): Promise<boolean> {
  const { conversationId, messageContent, senderId, receiverId, listingId } =
    params;

  const offerAmount = extractOfferAmount(messageContent);
  if (offerAmount === null) return false;

  // Check for selling agent with autoNegotiate
  const sellingAgent = await db.sellingAgent.findFirst({
    where: {
      listingId,
      status: "ACTIVE",
      autoNegotiate: true,
      userId: receiverId,
    },
    include: {
      listing: { select: { title: true, description: true, price: true } },
      user: { select: { id: true, name: true, avatar: true } },
      actions: {
        where: { actionType: "AUTO_NEGOTIATE" },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!sellingAgent) return false;

  // Count existing negotiation rounds in this conversation
  const negotiationRounds = await db.message.count({
    where: {
      conversationId,
      isAgentMessage: true,
      messageType: { in: ["COUNTER_OFFER", "OFFER"] },
    },
  });

  // Evaluate the offer
  const result = await evaluateOffer({
    offerPrice: offerAmount,
    currentPrice: sellingAgent.listing.price,
    rules: {
      minPrice: sellingAgent.minimumPrice,
      autoAcceptAbove:
        sellingAgent.autoAcceptAbove ?? sellingAgent.listing.price * 0.95,
      maxCounterRounds: 3,
      concessionRate: 0.3,
    },
    roundNumber: negotiationRounds,
    listingTitle: sellingAgent.listing.title,
    buyerMessage: messageContent,
  });

  // Determine message type and whether it needs approval
  let messageType: string;
  let requiresApproval = false;

  switch (result.action) {
    case "accept":
      messageType = "ACCEPTANCE";
      break;
    case "reject":
      messageType = "REJECTION";
      break;
    case "counter":
      messageType = "COUNTER_OFFER";
      break;
    case "escalate":
      messageType = "COUNTER_OFFER";
      requiresApproval = true;
      break;
    default:
      messageType = "TEXT";
  }

  const metadata = {
    offerPrice: offerAmount,
    counterPrice: result.counterPrice,
    action: result.action,
    reasoning: result.reasoning,
    roundNumber: negotiationRounds + 1,
  };

  if (requiresApproval) {
    // Create draft message and notify user for approval
    const draftMessage = await db.message.create({
      data: {
        conversationId,
        senderId: receiverId,
        receiverId: senderId,
        listingId,
        content: result.message,
        messageType: messageType as MessageType,
        isAgentMessage: true,
        requiresApproval: true,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    // Notify seller for approval
    emitPendingApproval(receiverId, {
      messageId: draftMessage.id,
      conversationId,
      content: result.message,
      messageType,
      agentType: "SELLING",
      metadata,
    });

    emitAgentAction(receiverId, {
      agentId: sellingAgent.id,
      agentType: "SELLING",
      actionType: "AUTO_NEGOTIATE",
      description: `Negotiation escalated: Buyer offered €${offerAmount}. ${result.reasoning}`,
      metadata,
      requiresApproval: true,
    });
  } else {
    // Send message directly
    await sendAgentMessage({
      conversationId,
      senderId: receiverId,
      receiverId: senderId,
      listingId,
      content: result.message,
      messageType,
      isAgentMessage: true,
      requiresApproval: false,
      metadata,
      agentId: sellingAgent.id,
      agentType: "SELLING",
      senderInfo: sellingAgent.user,
    });
  }

  // Log agent action
  await db.agentAction.create({
    data: {
      sellingAgentId: sellingAgent.id,
      agentType: "SELLING",
      actionType: "AUTO_NEGOTIATE",
      description: `${result.action}: Buyer offered €${offerAmount}. ${result.reasoning}`,
      metadata: metadata as Prisma.InputJsonValue,
      requiresApproval,
    },
  });

  // Update agent stats
  await db.sellingAgent.update({
    where: { id: sellingAgent.id },
    data: {
      totalOffers: { increment: 1 },
      ...(offerAmount > (sellingAgent.bestOfferPrice ?? 0)
        ? { bestOfferPrice: offerAmount }
        : {}),
    },
  });

  return true;
}

// ──────────────────────────────────────────────
// APPROVE / EDIT AGENT MESSAGE
// ──────────────────────────────────────────────

/** Approve an agent's pending message (optionally with edits) */
export async function approveAgentMessage(params: {
  messageId: string;
  userId: string;
  editedContent?: string;
}): Promise<void> {
  const message = await db.message.findUnique({
    where: { id: params.messageId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  if (!message || !message.requiresApproval) {
    throw new Error("Message not found or does not require approval");
  }

  if (message.senderId !== params.userId) {
    throw new Error("Only the sender can approve this message");
  }

  const content = params.editedContent || message.content;

  await db.message.update({
    where: { id: params.messageId },
    data: {
      content,
      approvedAt: new Date(),
      requiresApproval: false,
    },
  });

  // Update conversation timestamp
  await db.conversation.update({
    where: { id: message.conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Emit via socket
  const payload: SocketMessagePayload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    content,
    messageType: message.messageType,
    isAgentMessage: message.isAgentMessage,
    metadata: message.metadata as Record<string, unknown> | undefined,
    createdAt: new Date().toISOString(),
    sender: message.sender
      ? {
          id: message.sender.id,
          name: message.sender.name ?? "User",
          avatar: message.sender.avatar ?? undefined,
        }
      : undefined,
  };

  emitMessage(payload);
}

/** Reject an agent's pending message */
export async function rejectAgentMessage(
  messageId: string,
  userId: string,
): Promise<void> {
  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.senderId !== userId) {
    throw new Error("Message not found or unauthorized");
  }

  await db.message.delete({ where: { id: messageId } });
}

// ──────────────────────────────────────────────
// SEND AGENT MESSAGE HELPER
// ──────────────────────────────────────────────

async function sendAgentMessage(params: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  listingId: string;
  content: string;
  messageType: string;
  isAgentMessage: boolean;
  requiresApproval: boolean;
  metadata?: Record<string, unknown>;
  agentId: string;
  agentType: "SELLING" | "BUYING";
  senderInfo: { id: string; name: string | null; avatar: string | null };
}): Promise<void> {
  const message = await db.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      receiverId: params.receiverId,
      listingId: params.listingId,
      content: params.content,
      messageType: params.messageType as MessageType,
      isAgentMessage: params.isAgentMessage,
      requiresApproval: params.requiresApproval,
      metadata: params.metadata as Prisma.InputJsonValue,
    },
  });

  // Update conversation timestamp
  await db.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Emit via socket
  const payload: SocketMessagePayload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    content: message.content,
    messageType: message.messageType,
    isAgentMessage: message.isAgentMessage,
    metadata: params.metadata,
    createdAt: message.createdAt.toISOString(),
    sender: {
      id: params.senderInfo.id,
      name: params.senderInfo.name ?? "Agent",
      avatar: params.senderInfo.avatar ?? undefined,
    },
  };

  emitMessage(payload);
}

// ──────────────────────────────────────────────
// BUYING AGENT OUTREACH
// ──────────────────────────────────────────────

/** Buying agent sends initial message to a seller about a matched listing */
export async function sendBuyingAgentMessage(params: {
  buyingAgentId: string;
  listingId: string;
  sellerId: string;
  message: string;
  offerPrice?: number;
  requiresApproval: boolean;
}): Promise<void> {
  const agent = await db.buyingAgent.findUnique({
    where: { id: params.buyingAgentId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  if (!agent) throw new Error("Buying agent not found");

  // Find or create conversation
  let conversation = await db.conversation.findFirst({
    where: {
      listingId: params.listingId,
      buyerId: agent.userId,
      sellerId: params.sellerId,
    },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        listingId: params.listingId,
        buyerId: agent.userId,
        sellerId: params.sellerId,
      },
    });
  }

  const messageType = params.offerPrice ? "OFFER" : "TEXT";
  const metadata = params.offerPrice
    ? { offerPrice: params.offerPrice }
    : undefined;

  if (params.requiresApproval) {
    const draftMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: agent.userId,
        receiverId: params.sellerId,
        listingId: params.listingId,
        content: params.message,
        messageType: messageType as MessageType,
        isAgentMessage: true,
        requiresApproval: true,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    emitPendingApproval(agent.userId, {
      messageId: draftMessage.id,
      conversationId: conversation.id,
      content: params.message,
      messageType,
      agentType: "BUYING",
      metadata,
    });
  } else {
    await sendAgentMessage({
      conversationId: conversation.id,
      senderId: agent.userId,
      receiverId: params.sellerId,
      listingId: params.listingId,
      content: params.message,
      messageType,
      isAgentMessage: true,
      requiresApproval: false,
      metadata,
      agentId: params.buyingAgentId,
      agentType: "BUYING",
      senderInfo: agent.user,
    });
  }
}
