import { describe, it, expect, vi, beforeEach } from "vitest";
import { type TRPCContext, createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";
import { mockDb } from "@/__tests__/setup";

// Mock socket
vi.mock("@/server/socket", () => ({
  emitMessage: vi.fn(),
}));

// Mock messaging service
vi.mock("@/server/services/messaging", () => ({
  processAutoRespond: vi.fn().mockResolvedValue(undefined),
  processAutoNegotiate: vi.fn().mockResolvedValue(undefined),
  approveAgentMessage: vi.fn().mockResolvedValue(undefined),
  rejectAgentMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock translation service
vi.mock("@/server/services/translation", () => ({
  translateAndStoreMessage: vi.fn().mockResolvedValue(undefined),
  translateMessageOnDemand: vi.fn().mockResolvedValue("Translated text"),
  detectLanguage: vi.fn().mockReturnValue("en"),
}));

// Mock notification service
vi.mock("@/server/services/notification", () => ({
  notifyNewMessage: vi.fn().mockResolvedValue(undefined),
  notifyNegotiationEvent: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ────────────────────────────────────────────────
const createCaller = createCallerFactory(appRouter);
const validCuid = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
const validCuid2 = "clyyyyyyyyyyyyyyyyyyyyyyyy";

function authedCtx(userId = "user-1"): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext["db"],
    session: {
      user: {
        id: userId,
        name: "Test",
        email: "t@t.com",
        role: "USER",
        locale: "en",
      },
      expires: new Date(Date.now() + 86400_000).toISOString(),
    },
    headers: new Headers(),
  };
}

function anonCtx(): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext["db"],
    session: null,
    headers: new Headers(),
  };
}

// ─── Reset mocks ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// message.send
// ──────────────────────────────────────────────
describe("message.send", () => {
  const validInput = {
    receiverId: validCuid2,
    listingId: validCuid,
    content: "Hello, is this still available?",
  };

  it("creates a message in an existing conversation", async () => {
    const fakeMessage = {
      id: "msg-1",
      conversationId: "conv-1",
      senderId: "user-1",
      receiverId: validCuid2,
      content: validInput.content,
      messageType: "TEXT",
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.listing.findUnique
      .mockResolvedValueOnce({ userId: "seller-1" }) // For conversation lookup
      .mockResolvedValueOnce({ title: "Cool Item" }); // For notification
    mockDb.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.user.findUnique.mockResolvedValue({ id: validCuid2 });

    const caller = createCaller(authedCtx());
    const result = await caller.message.send(validInput);

    expect(result.id).toBe("msg-1");
    expect(result.content).toBe(validInput.content);
    expect(mockDb.message.create).toHaveBeenCalledOnce();
    expect(mockDb.conversation.update).toHaveBeenCalledOnce();
  });

  it("creates a new conversation when none exists", async () => {
    const fakeConv = { id: "conv-new" };
    const fakeMessage = {
      id: "msg-2",
      conversationId: "conv-new",
      senderId: "user-1",
      receiverId: validCuid2,
      content: validInput.content,
      messageType: "TEXT",
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.listing.findUnique
      .mockResolvedValueOnce({ userId: "seller-1" })
      .mockResolvedValueOnce({ title: "Cool Item" });
    mockDb.conversation.findFirst.mockResolvedValue(null);
    mockDb.conversation.create.mockResolvedValue(fakeConv);
    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.user.findUnique.mockResolvedValue({ id: validCuid2 });

    const caller = createCaller(authedCtx());
    const result = await caller.message.send(validInput);

    expect(result.id).toBe("msg-2");
    expect(mockDb.conversation.create).toHaveBeenCalledOnce();
  });

  it("uses provided conversationId when available", async () => {
    const fakeMessage = {
      id: "msg-3",
      conversationId: validCuid,
      senderId: "user-1",
      receiverId: validCuid2,
      content: "Follow-up message",
      messageType: "TEXT",
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.user.findUnique.mockResolvedValue({ id: validCuid2 });
    mockDb.listing.findUnique.mockResolvedValue({ title: "Item" });

    const caller = createCaller(authedCtx());
    const result = await caller.message.send({
      ...validInput,
      conversationId: validCuid,
      content: "Follow-up message",
    });

    expect(result.conversationId).toBe(validCuid);
    // Should NOT look up or create a conversation
    expect(mockDb.conversation.findFirst).not.toHaveBeenCalled();
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
  });

  it("throws when listing not found and no conversationId", async () => {
    mockDb.listing.findUnique.mockResolvedValue(null);

    const caller = createCaller(authedCtx());
    await expect(caller.message.send(validInput)).rejects.toThrow(
      "Listing not found",
    );
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.message.send(validInput)).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });

  it("rejects empty content", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.message.send({ ...validInput, content: "" }),
    ).rejects.toThrow();
  });

  it("rejects content over 2000 chars", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.message.send({ ...validInput, content: "x".repeat(2001) }),
    ).rejects.toThrow();
  });

  it("accepts exactly 2000 chars", async () => {
    const fakeMessage = {
      id: "msg-long",
      conversationId: validCuid,
      senderId: "user-1",
      receiverId: validCuid2,
      content: "x".repeat(2000),
      messageType: "TEXT",
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.user.findUnique.mockResolvedValue({ id: validCuid2 });
    mockDb.listing.findUnique.mockResolvedValue({ title: "Item" });

    const caller = createCaller(authedCtx());
    const result = await caller.message.send({
      ...validInput,
      conversationId: validCuid,
      content: "x".repeat(2000),
    });
    expect(result.id).toBe("msg-long");
  });
});

// ──────────────────────────────────────────────
// message.sendOffer
// ──────────────────────────────────────────────
describe("message.sendOffer", () => {
  const validInput = {
    conversationId: validCuid,
    receiverId: validCuid2,
    listingId: validCuid,
    offerPrice: 150,
  };

  it("creates an offer message", async () => {
    const fakeMessage = {
      id: "offer-1",
      conversationId: validCuid,
      senderId: "user-1",
      receiverId: validCuid2,
      content: "I'd like to offer €150 for this item.",
      messageType: "OFFER",
      metadata: { offerPrice: 150 },
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.listing.findUnique.mockResolvedValue({ title: "Widget" });

    const caller = createCaller(authedCtx());
    const result = await caller.message.sendOffer(validInput);

    expect(result.messageType).toBe("OFFER");
    expect(result.metadata).toEqual({ offerPrice: 150 });
    expect(mockDb.message.create).toHaveBeenCalledOnce();
  });

  it("uses custom message when provided", async () => {
    const customMsg = "Would you take 150 for this?";
    const fakeMessage = {
      id: "offer-2",
      conversationId: validCuid,
      senderId: "user-1",
      receiverId: validCuid2,
      content: customMsg,
      messageType: "OFFER",
      metadata: { offerPrice: 150 },
      originalLanguage: "en",
      createdAt: new Date(),
      sender: { id: "user-1", name: "Test", avatar: null },
    };

    mockDb.message.create.mockResolvedValue(fakeMessage);
    mockDb.conversation.update.mockResolvedValue({});
    mockDb.listing.findUnique.mockResolvedValue({ title: "Widget" });

    const caller = createCaller(authedCtx());
    const result = await caller.message.sendOffer({
      ...validInput,
      message: customMsg,
    });

    expect(result.content).toBe(customMsg);
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.message.sendOffer(validInput)).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });

  it("rejects non-positive offerPrice", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.message.sendOffer({ ...validInput, offerPrice: 0 }),
    ).rejects.toThrow();
  });

  it("rejects negative offerPrice", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.message.sendOffer({ ...validInput, offerPrice: -50 }),
    ).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────
// message.approveMessage
// ──────────────────────────────────────────────
describe("message.approveMessage", () => {
  it("approves a pending agent message", async () => {
    const caller = createCaller(authedCtx());
    const result = await caller.message.approveMessage({
      messageId: validCuid,
    });

    expect(result).toEqual({ success: true });

    const { approveAgentMessage } = await import("@/server/services/messaging");
    expect(approveAgentMessage).toHaveBeenCalledWith({
      messageId: validCuid,
      userId: "user-1",
      editedContent: undefined,
    });
  });

  it("passes edited content through", async () => {
    const caller = createCaller(authedCtx());
    await caller.message.approveMessage({
      messageId: validCuid,
      editedContent: "Revised response",
    });

    const { approveAgentMessage } = await import("@/server/services/messaging");
    expect(approveAgentMessage).toHaveBeenCalledWith({
      messageId: validCuid,
      userId: "user-1",
      editedContent: "Revised response",
    });
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(
      caller.message.approveMessage({ messageId: validCuid }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  it("propagates service error when message not found", async () => {
    const { approveAgentMessage } = await import("@/server/services/messaging");
    (approveAgentMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Message not found or does not require approval"),
    );

    const caller = createCaller(authedCtx());
    await expect(
      caller.message.approveMessage({ messageId: validCuid }),
    ).rejects.toThrow("Message not found");
  });
});

// ──────────────────────────────────────────────
// message.rejectMessage
// ──────────────────────────────────────────────
describe("message.rejectMessage", () => {
  it("rejects a pending agent message", async () => {
    const caller = createCaller(authedCtx());
    const result = await caller.message.rejectMessage({
      messageId: validCuid,
    });

    expect(result).toEqual({ success: true });

    const { rejectAgentMessage } = await import("@/server/services/messaging");
    expect(rejectAgentMessage).toHaveBeenCalledWith(validCuid, "user-1");
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(
      caller.message.rejectMessage({ messageId: validCuid }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  it("propagates service error on unauthorized rejection", async () => {
    const { rejectAgentMessage } = await import("@/server/services/messaging");
    (rejectAgentMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Message not found or unauthorized"),
    );

    const caller = createCaller(authedCtx());
    await expect(
      caller.message.rejectMessage({ messageId: validCuid }),
    ).rejects.toThrow("unauthorized");
  });
});

// ──────────────────────────────────────────────
// message.getMessages — authorization edge case
// ──────────────────────────────────────────────
describe("message.getMessages", () => {
  it("throws when user is not a conversation participant", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
      buyerId: "other-user-1",
      sellerId: "other-user-2",
    });

    const caller = createCaller(authedCtx());
    await expect(
      caller.message.getMessages({ conversationId: validCuid }),
    ).rejects.toThrow("Conversation not found");
  });

  it("returns messages and marks as read for participant", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
      buyerId: "user-1",
      sellerId: "seller-1",
    });
    mockDb.message.findMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "Hello",
        senderId: "seller-1",
        createdAt: new Date(),
        sender: { id: "seller-1", name: "Seller", avatar: null },
      },
    ]);
    mockDb.message.updateMany.mockResolvedValue({
      count: 1,
    });

    const caller = createCaller(authedCtx());
    const result = await caller.message.getMessages({
      conversationId: validCuid,
    });

    expect(result.messages).toHaveLength(1);
    expect(mockDb.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          receiverId: "user-1",
          isRead: false,
        }),
        data: { isRead: true },
      }),
    ) as unknown;
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(
      caller.message.getMessages({ conversationId: validCuid }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});
