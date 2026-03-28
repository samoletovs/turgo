import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';
import { createCallerFactory } from '@/server/trpc';
import { adminRouter } from '@/server/trpc/routers/admin';

// Mock ioredis for admin router's cache
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => {
    throw new Error('Redis unavailable');
  }),
}));

const createCaller = createCallerFactory(adminRouter);

function adminCaller(userId = 'admin-1') {
  // adminProcedure checks user role
  mockDb.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' });
  return createCaller({
    db: mockDb as never,
    session: {
      user: {
        id: userId,
        email: 'admin@test.com',
        role: 'ADMIN',
        locale: 'en',
      },
      expires: '',
    },
    headers: new Headers(),
  });
}

function moderatorCaller(userId = 'mod-1') {
  mockDb.user.findUnique.mockResolvedValue({ id: userId, role: 'MODERATOR' });
  return createCaller({
    db: mockDb as never,
    session: {
      user: {
        id: userId,
        email: 'mod@test.com',
        role: 'MODERATOR',
        locale: 'en',
      },
      expires: '',
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

function regularUserCaller(userId = 'user-1') {
  mockDb.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' });
  return createCaller({
    db: mockDb as never,
    session: {
      user: { id: userId, email: 'user@test.com', role: 'USER', locale: 'en' },
      expires: '',
    },
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// Authorization
// ──────────────────────────────────────────────────────────────
describe('authorization', () => {
  it('rejects unauthenticated users', async () => {
    await expect(unauthCaller().overview()).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejects regular users', async () => {
    await expect(regularUserCaller().overview()).rejects.toThrow('Admin access required');
  });

  it('allows admin users', async () => {
    mockDb.user.count.mockResolvedValue(0);
    mockDb.listing.count.mockResolvedValue(0);
    mockDb.report.count.mockResolvedValue(0);
    mockDb.escalationItem.count.mockResolvedValue(0);

    const result = await adminCaller().overview();
    expect(result).toHaveProperty('totalUsers');
  });

  it('allows moderator users', async () => {
    mockDb.user.count.mockResolvedValue(0);
    mockDb.listing.count.mockResolvedValue(0);
    mockDb.report.count.mockResolvedValue(0);
    mockDb.escalationItem.count.mockResolvedValue(0);

    const result = await moderatorCaller().overview();
    expect(result).toHaveProperty('totalUsers');
  });
});

// ──────────────────────────────────────────────────────────────
// overview
// ──────────────────────────────────────────────────────────────
describe('overview', () => {
  it('returns dashboard stats', async () => {
    mockDb.user.count
      .mockResolvedValueOnce(100) // totalUsers
      .mockResolvedValueOnce(15); // newUsersLast30
    mockDb.listing.count
      .mockResolvedValueOnce(200) // totalListings
      .mockResolvedValueOnce(180) // activeListings
      .mockResolvedValueOnce(5); // pendingModeration
    mockDb.report.count.mockResolvedValue(3);
    mockDb.escalationItem.count.mockResolvedValue(2);

    const result = await adminCaller().overview();

    expect(result.totalUsers).toBe(100);
    expect(result.totalListings).toBe(200);
    expect(result.activeListings).toBe(180);
    expect(result.pendingModeration).toBe(5);
    expect(result.openReports).toBe(3);
    expect(result.pendingEscalations).toBe(2);
    expect(result.newUsersLast30).toBe(15);
  });
});

// ──────────────────────────────────────────────────────────────
// moderationQueue
// ──────────────────────────────────────────────────────────────
describe('moderationQueue', () => {
  it('returns listings pending moderation with pagination', async () => {
    const listings = [
      {
        id: 'l1',
        status: 'MODERATION',
        user: { id: 'u1' },
        category: { slug: 'cars' },
      },
    ];
    mockDb.listing.findMany.mockResolvedValue(listings);
    mockDb.listing.count.mockResolvedValue(1);

    const result = await adminCaller().moderationQueue({
      status: 'MODERATION',
      page: 1,
      limit: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.pages).toBe(1);
  });

  it('filters by status', async () => {
    mockDb.listing.findMany.mockResolvedValue([]);
    mockDb.listing.count.mockResolvedValue(0);

    await adminCaller().moderationQueue({ status: 'REJECTED' });

    expect(mockDb.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'REJECTED' },
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// moderateAction
// ──────────────────────────────────────────────────────────────
describe('moderateAction', () => {
  it('approves a listing (sets status to ACTIVE)', async () => {
    mockDb.listing.update.mockResolvedValue({ id: 'l1', status: 'ACTIVE' });
    mockDb.moderationLog.create.mockResolvedValue({});

    const result = await adminCaller().moderateAction({
      listingId: 'l1',
      action: 'APPROVE',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a listing with reason', async () => {
    mockDb.listing.update.mockResolvedValue({ id: 'l1', status: 'REJECTED' });
    mockDb.moderationLog.create.mockResolvedValue({});

    const result = await adminCaller().moderateAction({
      listingId: 'l1',
      action: 'REJECT',
      reason: 'Inappropriate content',
    });

    expect(result.success).toBe(true);
  });

  it('flags a listing (keeps in MODERATION)', async () => {
    mockDb.listing.update.mockResolvedValue({ id: 'l1', status: 'MODERATION' });
    mockDb.moderationLog.create.mockResolvedValue({});

    const result = await adminCaller().moderateAction({
      listingId: 'l1',
      action: 'FLAG',
    });

    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Category management
// ──────────────────────────────────────────────────────────────
describe('categories', () => {
  it('returns top-level categories with children', async () => {
    const categories = [
      {
        id: 'c1',
        name: { en: 'Cars' },
        slug: 'cars',
        _count: { listings: 50, children: 2 },
        children: [],
      },
    ];
    mockDb.category.findMany.mockResolvedValue(categories);

    const result = await adminCaller().categories();

    expect(result).toHaveLength(1);
  });
});

describe('createCategory', () => {
  it('creates a new category', async () => {
    mockDb.category.create.mockResolvedValue({
      id: 'c-new',
      name: { en: 'Bikes' },
      slug: 'bikes',
    });

    const result = await adminCaller().createCategory({
      name: { en: 'Bikes' },
      slug: 'bikes',
    });

    expect(result.slug).toBe('bikes');
  });

  it('connects parent category when parentId provided', async () => {
    mockDb.category.create.mockResolvedValue({
      id: 'c-child',
      name: { en: 'Mountain Bikes' },
      slug: 'mountain-bikes',
    });

    await adminCaller().createCategory({
      name: { en: 'Mountain Bikes' },
      slug: 'mountain-bikes',
      parentId: 'c1',
    });

    expect(mockDb.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parent: { connect: { id: 'c1' } },
        }),
      }),
    );
  });
});

describe('deleteCategory', () => {
  it('deletes empty category', async () => {
    mockDb.category.count.mockResolvedValue(0); // no children
    mockDb.listing.count.mockResolvedValue(0); // no listings
    mockDb.category.delete.mockResolvedValue({ id: 'c1' });

    await adminCaller().deleteCategory({ id: 'c1' });

    expect(mockDb.category.delete).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
  });

  it('throws when category has children', async () => {
    mockDb.category.count.mockResolvedValue(3);

    await expect(adminCaller().deleteCategory({ id: 'c1' })).rejects.toThrow(
      'Cannot delete category with children',
    );
  });

  it('throws when category has listings', async () => {
    mockDb.category.count.mockResolvedValue(0);
    mockDb.listing.count.mockResolvedValue(5);

    await expect(adminCaller().deleteCategory({ id: 'c1' })).rejects.toThrow(
      'Cannot delete category with listings',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// User management
// ──────────────────────────────────────────────────────────────
describe('users', () => {
  it('returns paginated user list', async () => {
    mockDb.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com', role: 'USER' }]);
    mockDb.user.count.mockResolvedValue(1);

    const result = await adminCaller().users({ page: 1, limit: 20 });

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by role', async () => {
    mockDb.user.findMany.mockResolvedValue([]);
    mockDb.user.count.mockResolvedValue(0);

    await adminCaller().users({ role: 'ADMIN' });

    const callArgs = mockDb.user.findMany.mock.calls[0][0];
    expect(callArgs.where.role).toBe('ADMIN');
  });

  it('filters by search term', async () => {
    mockDb.user.findMany.mockResolvedValue([]);
    mockDb.user.count.mockResolvedValue(0);

    await adminCaller().users({ search: 'john' });

    const callArgs = mockDb.user.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
  });
});

describe('warnUser', () => {
  it('creates a warning for a user', async () => {
    mockDb.userWarning.create.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      reason: 'Spam',
    });

    const result = await adminCaller().warnUser({
      userId: 'u1',
      reason: 'Spam',
    });

    expect(result.reason).toBe('Spam');
  });
});

describe('banUser', () => {
  it('bans user permanently (no durationDays)', async () => {
    mockDb.userBan.create.mockResolvedValue({});
    mockDb.user.update.mockResolvedValue({});

    const result = await adminCaller().banUser({
      userId: 'u1',
      reason: 'Repeated violations',
    });

    expect(result.success).toBe(true);
  });

  it('bans user temporarily with durationDays', async () => {
    mockDb.userBan.create.mockResolvedValue({});
    mockDb.user.update.mockResolvedValue({});

    const result = await adminCaller().banUser({
      userId: 'u1',
      reason: 'Spam',
      durationDays: 7,
    });

    expect(result.success).toBe(true);
  });
});

describe('unbanUser', () => {
  it('unbans a user', async () => {
    mockDb.userBan.updateMany.mockResolvedValue({ count: 1 });
    mockDb.user.update.mockResolvedValue({});

    const result = await adminCaller().unbanUser({ userId: 'u1' });

    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Reports
// ──────────────────────────────────────────────────────────────
describe('reports', () => {
  it('returns paginated reports', async () => {
    mockDb.report.findMany.mockResolvedValue([{ id: 'r1', status: 'OPEN', listing: { id: 'l1' } }]);
    mockDb.report.count.mockResolvedValue(1);

    const result = await adminCaller().reports({ page: 1, limit: 20 });

    expect(result.reports).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by status', async () => {
    mockDb.report.findMany.mockResolvedValue([]);
    mockDb.report.count.mockResolvedValue(0);

    await adminCaller().reports({ status: 'OPEN' });

    const callArgs = mockDb.report.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBe('OPEN');
  });
});

describe('resolveReport', () => {
  it('resolves a report', async () => {
    mockDb.report.update.mockResolvedValue({
      id: 'r1',
      status: 'RESOLVED',
    });

    const result = await adminCaller().resolveReport({
      reportId: 'r1',
      action: 'RESOLVED',
      note: 'Listing removed',
    });

    expect(result.status).toBe('RESOLVED');
  });

  it('dismisses a report', async () => {
    mockDb.report.update.mockResolvedValue({
      id: 'r1',
      status: 'DISMISSED',
    });

    const result = await adminCaller().resolveReport({
      reportId: 'r1',
      action: 'DISMISSED',
    });

    expect(result.status).toBe('DISMISSED');
  });
});

// ──────────────────────────────────────────────────────────────
// Location management
// ──────────────────────────────────────────────────────────────
describe('deleteLocation', () => {
  it('deletes location without children', async () => {
    mockDb.location.count.mockResolvedValue(0);
    mockDb.location.delete.mockResolvedValue({ id: 'loc-1' });

    await adminCaller().deleteLocation({ id: 'loc-1' });

    expect(mockDb.location.delete).toHaveBeenCalled();
  });

  it('throws when location has children', async () => {
    mockDb.location.count.mockResolvedValue(2);

    await expect(adminCaller().deleteLocation({ id: 'loc-1' })).rejects.toThrow(
      'Cannot delete location with children',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// Escalations
// ──────────────────────────────────────────────────────────────
describe('escalations', () => {
  it('returns paginated escalation items', async () => {
    mockDb.escalationItem.findMany.mockResolvedValue([
      { id: 'e1', status: 'PENDING', source: 'SELLING_AGENT' },
    ]);
    mockDb.escalationItem.count.mockResolvedValue(1);

    const result = await adminCaller().escalations({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe('resolveEscalation', () => {
  it('resolves an escalation', async () => {
    mockDb.escalationItem.update.mockResolvedValue({
      id: 'e1',
      status: 'RESOLVED',
    });

    const result = await adminCaller().resolveEscalation({
      id: 'e1',
      action: 'RESOLVED',
      note: 'Fixed',
    });

    expect(result.status).toBe('RESOLVED');
  });
});
