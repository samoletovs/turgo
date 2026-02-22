import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { createCallerFactory } from "@/server/trpc";
import { categoryRouter } from "@/server/trpc/routers/category";

const createCaller = createCallerFactory(categoryRouter);

function publicCaller() {
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
// getAll
// ──────────────────────────────────────────────────────────────
describe("getAll", () => {
  it("returns top-level active categories with children", async () => {
    const categories = [
      {
        id: "c1",
        name: { en: "Cars", lv: "Auto" },
        slug: "cars",
        icon: "🚗",
        _count: { listings: 120 },
        children: [
          {
            id: "c1-1",
            name: { en: "Sedans" },
            slug: "sedans",
            _count: { listings: 50 },
          },
          {
            id: "c1-2",
            name: { en: "SUVs" },
            slug: "suvs",
            _count: { listings: 70 },
          },
        ],
      },
      {
        id: "c2",
        name: { en: "Electronics" },
        slug: "electronics",
        icon: "💻",
        _count: { listings: 80 },
        children: [],
      },
    ];
    mockDb.category.findMany.mockResolvedValue(categories);

    const result = await publicCaller().getAll();

    expect(result).toHaveLength(2);
    expect(result[0].children).toHaveLength(2);
    expect(result[0]._count.listings).toBe(120);
  });

  it("only returns active categories", async () => {
    mockDb.category.findMany.mockResolvedValue([]);

    await publicCaller().getAll();

    expect(mockDb.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: null, isActive: true },
      }),
    );
  });

  it("orders by sortOrder ascending", async () => {
    mockDb.category.findMany.mockResolvedValue([]);

    await publicCaller().getAll();

    expect(mockDb.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: "asc" },
      }),
    );
  });

  it("returns empty array when no categories exist", async () => {
    mockDb.category.findMany.mockResolvedValue([]);

    const result = await publicCaller().getAll();

    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// getBySlug
// ──────────────────────────────────────────────────────────────
describe("getBySlug", () => {
  it("returns category with parent, children, and attributes", async () => {
    const category = {
      id: "c1",
      name: { en: "Cars" },
      slug: "cars",
      parent: null,
      children: [{ id: "c1-1", slug: "sedans", _count: { listings: 30 } }],
      attributes: [
        { id: "a1", name: "Brand", type: "SELECT", sortOrder: 0 },
        { id: "a2", name: "Year", type: "NUMBER", sortOrder: 1 },
      ],
      _count: { listings: 100 },
    };
    mockDb.category.findUnique.mockResolvedValue(category);

    const result = await publicCaller().getBySlug({ slug: "cars" });

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("cars");
    expect(result!.children).toHaveLength(1);
    expect(result!.attributes).toHaveLength(2);
  });

  it("returns null for non-existent slug", async () => {
    mockDb.category.findUnique.mockResolvedValue(null);

    const result = await publicCaller().getBySlug({ slug: "nonexistent" });

    expect(result).toBeNull();
  });

  it("includes parent relationship", async () => {
    const category = {
      id: "c1-1",
      slug: "sedans",
      parent: { id: "c1", slug: "cars", name: { en: "Cars" } },
      children: [],
      attributes: [],
      _count: { listings: 30 },
    };
    mockDb.category.findUnique.mockResolvedValue(category);

    const result = await publicCaller().getBySlug({ slug: "sedans" });

    expect(result!.parent).toBeDefined();
    expect(result!.parent!.slug).toBe("cars");
  });

  it("queries by slug", async () => {
    mockDb.category.findUnique.mockResolvedValue(null);

    await publicCaller().getBySlug({ slug: "electronics" });

    expect(mockDb.category.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "electronics" },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// getTree
// ──────────────────────────────────────────────────────────────
describe("getTree", () => {
  it("returns all active categories as flat tree", async () => {
    const allCategories = [
      { id: "c1", slug: "cars", parentId: null, _count: { listings: 100 } },
      {
        id: "c2",
        slug: "electronics",
        parentId: null,
        _count: { listings: 80 },
      },
      { id: "c1-1", slug: "sedans", parentId: "c1", _count: { listings: 50 } },
      { id: "c2-1", slug: "phones", parentId: "c2", _count: { listings: 40 } },
    ];
    mockDb.category.findMany.mockResolvedValue(allCategories);

    const result = await publicCaller().getTree();

    expect(result).toHaveLength(4);
  });

  it("only returns active categories", async () => {
    mockDb.category.findMany.mockResolvedValue([]);

    await publicCaller().getTree();

    expect(mockDb.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
  });

  it("includes listing count", async () => {
    mockDb.category.findMany.mockResolvedValue([
      { id: "c1", slug: "cars", _count: { listings: 42 } },
    ]);

    const result = await publicCaller().getTree();

    expect(result[0]._count.listings).toBe(42);
  });
});
