import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb } from '@/__tests__/setup';

// ── Mocks ────────────────────────────────────────────────────

vi.mock('@/server/db', () => ({
  db: mockDb,
}));

vi.mock('@/server/socket', () => ({
  emitNotification: vi.fn(),
}));

vi.mock('@/server/services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// web-push is optional; avoid hard import failures in CI
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

// ── Helpers ──────────────────────────────────────────────────

const fakeNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'NEW_MESSAGE',
  title: 'New message',
  body: 'Hello',
  isRead: false,
  createdAt: new Date(),
  metadata: null,
};

// ──────────────────────────────────────────────
// notifyNewMessage
// ──────────────────────────────────────────────
describe('notifyNewMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an in-app notification and emits via socket', async () => {
    mockDb.notification.create.mockResolvedValue(fakeNotification);
    // No push subscriptions → skip push
    mockDb.pushSubscription.findMany.mockResolvedValue([]);

    const { notifyNewMessage } = await import('@/server/services/notification');
    const { emitNotification } = await import('@/server/socket');

    await notifyNewMessage({
      receiverId: 'user-1',
      senderId: 'user-2',
      senderName: 'Alice',
      conversationId: 'conv-1',
      listingTitle: 'Vintage Camera',
      messagePreview: 'Is this still available?',
      isAgentMessage: false,
    });

    expect(mockDb.notification.create).toHaveBeenCalledOnce();
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'NEW_MESSAGE',
        }),
      }),
    );

    expect(emitNotification).toHaveBeenCalledOnce();
    expect(emitNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        id: 'notif-1',
        type: 'NEW_MESSAGE',
      }),
    );
  });

  it('includes agent prefix in title for agent messages', async () => {
    mockDb.notification.create.mockResolvedValue({ ...fakeNotification, id: 'notif-2' });
    mockDb.pushSubscription.findMany.mockResolvedValue([]);

    const { notifyNewMessage } = await import('@/server/services/notification');

    await notifyNewMessage({
      receiverId: 'user-1',
      senderId: 'user-2',
      senderName: 'BuyBot',
      conversationId: 'conv-2',
      listingTitle: 'Vintage Camera',
      messagePreview: 'I would like to offer €50',
      isAgentMessage: true,
    });

    const call = mockDb.notification.create.mock.calls[0][0];
    expect(call.data.title).toContain('🤖 Agent:');
  });

  it('truncates long message previews in the body', async () => {
    mockDb.notification.create.mockResolvedValue({ ...fakeNotification, id: 'notif-3' });
    mockDb.pushSubscription.findMany.mockResolvedValue([]);

    const { notifyNewMessage } = await import('@/server/services/notification');

    const longPreview = 'a'.repeat(200);

    await notifyNewMessage({
      receiverId: 'user-1',
      senderId: 'user-2',
      senderName: 'Bob',
      conversationId: 'conv-3',
      listingTitle: 'Bike',
      messagePreview: longPreview,
      isAgentMessage: false,
    });

    const call = mockDb.notification.create.mock.calls[0][0];
    // body should contain a slice of the preview, not the full 200-char string
    expect(call.data.body.length).toBeLessThan(200);
  });

  it('attaches conversationId and senderId to notification metadata', async () => {
    mockDb.notification.create.mockResolvedValue({ ...fakeNotification, id: 'notif-4' });
    mockDb.pushSubscription.findMany.mockResolvedValue([]);

    const { notifyNewMessage } = await import('@/server/services/notification');

    await notifyNewMessage({
      receiverId: 'user-1',
      senderId: 'user-2',
      senderName: 'Carol',
      conversationId: 'conv-4',
      listingTitle: 'Laptop',
      messagePreview: 'Can I buy this?',
      isAgentMessage: false,
    });

    const call = mockDb.notification.create.mock.calls[0][0];
    expect(call.data.metadata).toMatchObject({
      conversationId: 'conv-4',
      senderId: 'user-2',
    });
  });
});

// ──────────────────────────────────────────────
// createNotification
// ──────────────────────────────────────────────
describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists notification and emits real-time event', async () => {
    mockDb.notification.create.mockResolvedValue(fakeNotification);

    const { createNotification } = await import('@/server/services/notification');
    const { emitNotification } = await import('@/server/socket');

    await createNotification({
      userId: 'user-1',
      type: 'NEW_MESSAGE',
      title: 'Test',
      body: 'Hello',
    });

    expect(mockDb.notification.create).toHaveBeenCalledOnce();
    expect(emitNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'notif-1', type: 'NEW_MESSAGE' }),
    );
  });
});
