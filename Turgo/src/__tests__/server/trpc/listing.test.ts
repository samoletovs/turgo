import { describe, it, expect, vi, beforeEach } from "vitest";
import { type TRPCContext, createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";
import { mockDb } from "@/__tests__/setup";

// ─── Helpers ────────────────────────────────────────────────
const createCaller = createCallerFactory(appRouter);

function authedCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext["db"],
    session: {
      user: { id: "user-1", name: "Test", email: "t@t.com", role: "USER" },
      expires: new Date(Date.now() + 86400_000).toISOString(),
    },
    ...overrides,
  };
}

function anonCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    db: mockDb as unknown as TRPCContext["db"],
    session: null,
    ...overrides,
  };
}

// ─── Reset mocks ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listing.create ─────────────────────────────────────────
describe("listing.create", () => {
  const validInput = {
    title: "Great item for sale",
    description:
      "A really nice item that is in great condition and worth buying right now.",
    price: 150,
    categoryId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
  };

  it("creates a listing with valid input", async () => {
    const fakeListing = {
      id: "listing-1",
      ...validInput,
      slug: "great-item-for-sale-abc123",
      userId: "user-1",
      status: "DRAFT",
      price: 150,
    };

    mockDb.listing.create.mockResolvedValue(fakeListing);
    mockDb.priceHistory.create.mockResolvedValue({});

    const caller = createCaller(authedCtx());
    const result = await caller.listing.create(validInput);

    expect(result).toMatchObject({ id: "listing-1", status: "DRAFT" });
    expect(mockDb.listing.create).toHaveBeenCalledOnce();
    expect(mockDb.priceHistory.create).toHaveBeenCalledWith({
      data: { listingId: "listing-1", price: 150 },
    });
  });

  it("throws UNAUTHORIZED without session", async () => {
    const caller = createCaller(anonCtx());
    await expect(caller.listing.create(validInput)).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });

  it("throws on invalid input (short title)", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.listing.create({ ...validInput, title: "Hi" }),
    ).rejects.toThrow();
  });

  it("throws on invalid input (negative price)", async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.listing.create({ ...validInput, price: -5 }),
    ).rejects.toThrow();
  });
});

// ─── listing.getById ────────────────────────────────────────
describe("listing.getById", () => {
  it("returns listing with correct shape", async () => {
    const fakeListing = {
      id: "listing-1",
      title: "Test Listing",
      description: "A test",
      price: 100,
      slug: "test-listing",
      status: "ACTIVE",
      user: { id: "user-1", name: "Test", avatar: null },
      category: { id: "cat-1", name: "Electronics" },
      location: null,
      images: [],
      attributes: [],
      sellingAgent: null,
      boosts: [],
      _count: { favorites: 0 },
    };

    mockDb.listing.findUnique.mockResolvedValue(fakeListing);
    mockDb.listing.update.mockResolvedValue({});

    const caller = createCaller(anonCtx());
    const result = await caller.listing.getById({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toMatchObject({
      id: "listing-1",
      title: "Test Listing",
      user: expect.objectContaining({ id: "user-1" }),
      category: expect.objectContaining({ id: "cat-1" }),
    });
    expect(mockDb.listing.findUnique).toHaveBeenCalledOnce();
    // viewCount should be incremented
    expect(mockDb.listing.update).toHaveBeenCalledWith({
      where: { id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" },
      data: { viewCount: { increment: 1 } },
    });
  });

  it("returns null for non-existent listing", async () => {
    mockDb.listing.findUnique.mockResolvedValue(null);

    const caller = createCaller(anonCtx());
    const result = await caller.listing.getById({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toBeNull();
    // Should NOT increment view count
    expect(mockDb.listing.update).not.toHaveBeenCalled();
  });

  it("rejects invalid id format", async () => {
    const caller = createCaller(anonCtx());
    await expect(
      caller.listing.getById({ id: "not-a-cuid" }),
    ).rejects.toThrow();
  });
});
