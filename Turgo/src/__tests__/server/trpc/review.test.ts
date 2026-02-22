import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { createCallerFactory } from "@/server/trpc";
import { reviewRouter } from "@/server/trpc/routers/review";

const createCaller = createCallerFactory(reviewRouter);

function publicCaller() {
  return createCaller({
    db: mockDb as never,
    session: null,
    headers: new Headers(),
  });
}

function authedCaller(userId = "user-1") {
  return createCaller({
    db: mockDb as never,
    session: {
      user: { id: userId, email: "test@test.com", role: "USER", locale: "en" },
      expires: "",
    },
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────
describe("create", () => {
  it("creates a review when user has had a conversation", async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
    mockDb.review.findFirst.mockResolvedValue(null);
    mockDb.review.create.mockResolvedValue({
      id: "rev-1",
      reviewerId: "user-1",
      revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      rating: 5,
      comment: "Great seller!",
    });

    const result = await authedCaller().create({
      revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      rating: 5,
      comment: "Great seller!",
    });

    expect(result.rating).toBe(5);
    expect(mockDb.review.create).toHaveBeenCalled();
  });

  it("throws when trying to review yourself", async () => {
    await expect(
      authedCaller("clxxxxxxxxxxxxxxxxxxxxxxxxx").create({
        revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        rating: 5,
      }),
    ).rejects.toThrow("cannot review yourself");
  });

  it("throws when no conversation exists with reviewee", async () => {
    mockDb.conversation.findFirst.mockResolvedValue(null);

    await expect(
      authedCaller().create({
        revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        rating: 4,
      }),
    ).rejects.toThrow(
      "You can only review users you have had a conversation with",
    );
  });

  it("throws when review already exists", async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
    mockDb.review.findFirst.mockResolvedValue({ id: "existing-review" });

    await expect(
      authedCaller().create({
        revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        rating: 3,
      }),
    ).rejects.toThrow("already reviewed");
  });

  it("validates rating range (1-5)", async () => {
    await expect(
      authedCaller().create({
        revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        rating: 0,
      }),
    ).rejects.toThrow();

    await expect(
      authedCaller().create({
        revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        rating: 6,
      }),
    ).rejects.toThrow();
  });

  it("allows review without comment", async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
    mockDb.review.findFirst.mockResolvedValue(null);
    mockDb.review.create.mockResolvedValue({
      id: "rev-1",
      rating: 4,
      comment: undefined,
    });

    const result = await authedCaller().create({
      revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      rating: 4,
    });

    expect(result.rating).toBe(4);
  });

  it("allows review with listingId", async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ id: "conv-1" });
    mockDb.review.findFirst.mockResolvedValue(null);
    mockDb.review.create.mockResolvedValue({
      id: "rev-1",
      rating: 5,
      listingId: "clyyyyyyyyyyyyyyyyyyyyyyyyy",
    });

    const result = await authedCaller().create({
      revieweeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      rating: 5,
      listingId: "clyyyyyyyyyyyyyyyyyyyyyyyyy",
    });

    expect(result).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// getForUser
// ──────────────────────────────────────────────────────────────
describe("getForUser", () => {
  it("returns paginated reviews with aggregate stats", async () => {
    mockDb.review.findMany.mockResolvedValue([
      {
        id: "r1",
        rating: 5,
        comment: "Great!",
        reviewer: { id: "u1", name: "John", avatar: null },
      },
      {
        id: "r2",
        rating: 4,
        comment: "Good",
        reviewer: { id: "u2", name: "Jane", avatar: null },
      },
    ]);
    mockDb.review.count.mockResolvedValue(2);
    mockDb.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });

    const result = await publicCaller().getForUser({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      page: 1,
      limit: 10,
    });

    expect(result.reviews).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.averageRating).toBe(4.5);
    expect(result.totalReviews).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it("returns zero average when no reviews", async () => {
    mockDb.review.findMany.mockResolvedValue([]);
    mockDb.review.count.mockResolvedValue(0);
    mockDb.review.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    const result = await publicCaller().getForUser({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it("is accessible without authentication (public)", async () => {
    mockDb.review.findMany.mockResolvedValue([]);
    mockDb.review.count.mockResolvedValue(0);
    mockDb.review.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    const result = await publicCaller().getForUser({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toHaveProperty("reviews");
  });

  it("paginates correctly", async () => {
    mockDb.review.findMany.mockResolvedValue([]);
    mockDb.review.count.mockResolvedValue(25);
    mockDb.review.aggregate.mockResolvedValue({
      _avg: { rating: 4 },
      _count: { rating: 25 },
    });

    const result = await publicCaller().getForUser({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      page: 3,
      limit: 10,
    });

    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(3);
  });
});
