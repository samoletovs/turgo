import { vi } from "vitest";

// ─── Mock next-intl ──────────────────────────────────────────
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  getTranslations: () => (key: string) => key,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "en",
  getMessages: async () => ({}),
}));

// ─── Mock next/navigation ────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// ─── Mock Prisma (db) ────────────────────────────────────────
// Factory that creates a mock matching the PrismaClient shape used in the app.
function createMockPrismaModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

export const mockDb = {
  user: createMockPrismaModel(),
  listing: createMockPrismaModel(),
  category: createMockPrismaModel(),
  location: createMockPrismaModel(),
  image: createMockPrismaModel(),
  favorite: createMockPrismaModel(),
  conversation: createMockPrismaModel(),
  message: createMockPrismaModel(),
  sellingAgent: createMockPrismaModel(),
  buyingAgent: createMockPrismaModel(),
  agentAction: createMockPrismaModel(),
  priceHistory: createMockPrismaModel(),
  boost: createMockPrismaModel(),
  subscription: createMockPrismaModel(),
  notification: createMockPrismaModel(),
  searchQuery: createMockPrismaModel(),
  listingAttribute: createMockPrismaModel(),
  categoryAttribute: createMockPrismaModel(),
  account: createMockPrismaModel(),
  session: createMockPrismaModel(),
  offer: createMockPrismaModel(),
  review: createMockPrismaModel(),
  marketSnapshot: createMockPrismaModel(),
  agentMatch: createMockPrismaModel(),
  savedSearch: createMockPrismaModel(),
  plan: createMockPrismaModel(),
  listingBoost: createMockPrismaModel(),
  moderationLog: createMockPrismaModel(),
  report: createMockPrismaModel(),
  userWarning: createMockPrismaModel(),
  userBan: createMockPrismaModel(),
  escalationItem: createMockPrismaModel(),
  searchLog: createMockPrismaModel(),
  agentMetrics: createMockPrismaModel(),
  $transaction: vi.fn((fnOrArray: unknown) => {
    if (typeof fnOrArray === "function") return fnOrArray(mockDb);
    if (Array.isArray(fnOrArray)) return Promise.all(fnOrArray);
    return fnOrArray;
  }),
  $queryRaw: vi.fn().mockResolvedValue([]),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock("@/server/db", () => ({
  db: mockDb,
  default: mockDb,
}));

// ─── Mock rate-limit (always allow in tests by default) ──────
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 99,
    reset: Date.now() + 60_000,
  }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
