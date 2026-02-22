import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { createCallerFactory } from "@/server/trpc";
import { favoriteRouter } from "@/server/trpc/routers/favorite";

const createCaller = createCallerFactory(favoriteRouter);

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

function unauthCaller() {
  return createCaller({
    db: mockDb as never,
    session: null,
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// toggle
// ──────────────────────────────────────────────────────────────
describe("toggle", () => {
  it("adds favorite when not already favorited", async () => {
    mockDb.favorite.findUnique.mockResolvedValue(null);
    mockDb.favorite.create.mockResolvedValue({
      id: "fav-1",
      userId: "user-1",
      listingId: "listing-1",
    });

    const result = await authedCaller().toggle({
      listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.favorited).toBe(true);
    expect(mockDb.favorite.create).toHaveBeenCalledWith({
      data: { userId: "user-1", listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx" },
    });
  });

  it("removes favorite when already favorited", async () => {
    mockDb.favorite.findUnique.mockResolvedValue({
      id: "fav-1",
      userId: "user-1",
      listingId: "listing-1",
    });
    mockDb.favorite.delete.mockResolvedValue({ id: "fav-1" });

    const result = await authedCaller().toggle({
      listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.favorited).toBe(false);
    expect(mockDb.favorite.delete).toHaveBeenCalledWith({
      where: { id: "fav-1" },
    });
  });

  it("rejects unauthenticated users", async () => {
    await expect(
      unauthCaller().toggle({ listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
});

// ──────────────────────────────────────────────────────────────
// myFavorites
// ──────────────────────────────────────────────────────────────
describe("myFavorites", () => {
  it("returns paginated favorites for user", async () => {
    mockDb.favorite.findMany.mockResolvedValue([
      {
        id: "fav-1",
        listing: {
          id: "l1",
          title: "Car",
          images: [],
          location: null,
          category: null,
        },
      },
      {
        id: "fav-2",
        listing: {
          id: "l2",
          title: "Phone",
          images: [],
          location: null,
          category: null,
        },
      },
    ]);
    mockDb.favorite.count.mockResolvedValue(2);

    const result = await authedCaller().myFavorites({ page: 1, limit: 20 });

    expect(result.favorites).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("paginates correctly", async () => {
    mockDb.favorite.findMany.mockResolvedValue([]);
    mockDb.favorite.count.mockResolvedValue(50);

    const result = await authedCaller().myFavorites({ page: 3, limit: 10 });

    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(3);
    expect(mockDb.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
  });

  it("filters by user ID", async () => {
    mockDb.favorite.findMany.mockResolvedValue([]);
    mockDb.favorite.count.mockResolvedValue(0);

    await authedCaller("user-42").myFavorites({ page: 1, limit: 20 });

    expect(mockDb.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-42" },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// isFavorited
// ──────────────────────────────────────────────────────────────
describe("isFavorited", () => {
  it("returns true when listing is favorited", async () => {
    mockDb.favorite.findUnique.mockResolvedValue({ id: "fav-1" });

    const result = await authedCaller().isFavorited({
      listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.favorited).toBe(true);
  });

  it("returns false when listing is not favorited", async () => {
    mockDb.favorite.findUnique.mockResolvedValue(null);

    const result = await authedCaller().isFavorited({
      listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.favorited).toBe(false);
  });

  it("checks correct user-listing combination", async () => {
    mockDb.favorite.findUnique.mockResolvedValue(null);

    await authedCaller("user-5").isFavorited({
      listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(mockDb.favorite.findUnique).toHaveBeenCalledWith({
      where: {
        userId_listingId: {
          userId: "user-5",
          listingId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        },
      },
    });
  });
});
