import { createServer, type Server as HTTPServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketIOServer } from 'socket.io';
import { mockDb } from '@/__tests__/setup';
import type { ReadReceiptPayload, SocketMessagePayload, TypingPayload } from '@/server/socket';

const decodeMock = vi.hoisted(() =>
  vi.fn(async ({ token }: { token?: string }) => (token ? { id: token } : null)),
);

vi.mock('next-auth/jwt', () => ({
  decode: decodeMock,
}));

vi.mock('ioredis', () => ({
  default: class MockRedis {
    connect() {
      return Promise.reject(new Error('Redis unavailable'));
    }

    disconnect() {}

    get() {
      return Promise.resolve(null);
    }

    set() {
      return Promise.resolve('OK');
    }

    del() {
      return Promise.resolve(0);
    }

    subscribe() {
      return Promise.resolve(0);
    }
  },
}));

type SocketModule = typeof import('@/server/socket');

const SOCKET_CLIENT_TIMEOUT_MS = 1000;
const CONNECT_PROMISE_TIMEOUT_MS = SOCKET_CLIENT_TIMEOUT_MS + 500;
const POLL_DEADLINE_MS = 1000;

let httpServer: HTTPServer;
let socketServer: SocketIOServer;
let socketModule: SocketModule;
let baseUrl: string;
const connectedClients: ClientSocket[] = [];

function configureConversationAccess() {
  mockDb.conversation.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      where.id === 'conversation-1' ? { buyerId: 'user-1', sellerId: 'user-2' } : null,
  );
}

function connectClient(userId?: string): Promise<ClientSocket> {
  const client = createSocketClient(baseUrl, {
    path: '/api/socketio',
    transports: ['websocket'],
    auth: userId ? { token: userId } : {},
    forceNew: true,
    reconnection: false,
    timeout: SOCKET_CLIENT_TIMEOUT_MS,
  });

  connectedClients.push(client);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Socket connection timed out')),
      CONNECT_PROMISE_TIMEOUT_MS,
    );

    client.once('connect', () => {
      clearTimeout(timeout);
      resolve(client);
    });

    client.once('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function waitForEvent<T>(client: ClientSocket, event: string, timeoutMs = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    client.once(event, onEvent);
  });
}

function waitForNoEvent(client: ClientSocket, event: string, timeoutMs = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(event, onEvent);
      resolve();
    }, timeoutMs);

    const onEvent = () => {
      clearTimeout(timeout);
      reject(new Error(`Unexpected ${event} event`));
    };

    client.once(event, onEvent);
  });
}

function connectedSocketId(client: ClientSocket): string {
  expect(client.id).toBeTypeOf('string');
  return client.id ?? '';
}

async function waitForServerSocketCount(expectedSize: number): Promise<void> {
  const deadline = Date.now() + POLL_DEADLINE_MS;

  while (Date.now() < deadline) {
    const sockets = await socketServer.fetchSockets();
    if (sockets.length === expectedSize) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const sockets = await socketServer.fetchSockets();
  expect(sockets.length).toBe(expectedSize);
}

async function waitForRoomMembers(room: string, expectedIds: string[]): Promise<void> {
  const deadline = Date.now() + POLL_DEADLINE_MS;

  while (Date.now() < deadline) {
    const sockets = await socketServer.in(room).fetchSockets();
    const socketIds = new Set(sockets.map((socket) => socket.id));
    if (sockets.length === expectedIds.length && expectedIds.every((id) => socketIds.has(id))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const sockets = await socketServer.in(room).fetchSockets();
  expect(sockets.map((socket) => socket.id).sort()).toEqual([...expectedIds].sort());
}

async function waitForOnlineStatus(userId: string, expected: boolean): Promise<void> {
  const deadline = Date.now() + POLL_DEADLINE_MS;

  while (Date.now() < deadline) {
    if ((await socketModule.isUserOnline(userId)) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  expect(await socketModule.isUserOnline(userId)).toBe(expected);
}

async function disconnectAllClients(): Promise<void> {
  const clients = connectedClients.splice(0);

  await Promise.all(
    clients.map(
      (client) =>
        new Promise<void>((resolve) => {
          if (!client.connected) {
            resolve();
            return;
          }

          client.once('disconnect', () => resolve());
          client.disconnect();
        }),
    ),
  );

  await waitForServerSocketCount(0);
}

beforeAll(async () => {
  process.env.AUTH_SECRET = 'socket-test-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

  httpServer = createServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  socketModule = await import('@/server/socket');
  socketServer = await socketModule.initSocketServer(httpServer);
});

afterAll(async () => {
  await disconnectAllClients();
  await new Promise<void>((resolve) => socketServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  configureConversationAccess();
});

afterEach(async () => {
  await disconnectAllClients();
});

describe('Socket.IO real-time messaging', () => {
  it('rejects unauthenticated WebSocket connections', async () => {
    const client = createSocketClient(baseUrl, {
      path: '/api/socketio',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: SOCKET_CLIENT_TIMEOUT_MS,
    });
    connectedClients.push(client);

    const error = await waitForEvent<Error>(client, 'connect_error');

    expect(error.message).toBe('Authentication required');
    expect(client.connected).toBe(false);
  });

  it('tracks authenticated users as online through their personal rooms', async () => {
    const client = await connectClient('user-1');

    expect(client.io.engine.transport.name).toBe('websocket');
    expect(await socketModule.isUserOnline('user-1')).toBe(true);
    expect(await socketModule.getOnlineUserCount()).toBe(1);

    client.disconnect();

    await waitForOnlineStatus('user-1', false);
  });

  it('delivers messages only to authorized conversation participants and receiver notifications', async () => {
    const sender = await connectClient('user-1');
    const receiver = await connectClient('user-2');
    const intruder = await connectClient('user-3');

    const intruderRejected = waitForEvent<{ conversationId: string; error: string }>(
      intruder,
      'conversation:error',
    );

    sender.emit('join:conversation', 'conversation-1');
    receiver.emit('join:conversation', 'conversation-1');
    intruder.emit('join:conversation', 'conversation-1');

    await expect(intruderRejected).resolves.toMatchObject({
      conversationId: 'conversation-1',
      error: expect.any(String),
    });
    await waitForRoomMembers('conversation:conversation-1', [
      connectedSocketId(sender),
      connectedSocketId(receiver),
    ]);

    const senderMessage = waitForEvent<SocketMessagePayload>(sender, 'message:new');
    const receiverMessage = waitForEvent<SocketMessagePayload>(receiver, 'message:new');
    const receiverNotification = waitForEvent<{
      conversationId: string;
      senderId: string;
      preview: string;
      isAgentMessage: boolean;
      messageType: string;
    }>(receiver, 'message:notification');
    const intruderMessage = waitForNoEvent(intruder, 'message:new');

    socketModule.emitMessage({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'user-1',
      receiverId: 'user-2',
      content: 'Hello from real-time test',
      messageType: 'TEXT',
      isAgentMessage: false,
      createdAt: new Date().toISOString(),
    });

    await expect(senderMessage).resolves.toMatchObject({ id: 'message-1' });
    await expect(receiverMessage).resolves.toMatchObject({ id: 'message-1' });
    await expect(receiverNotification).resolves.toMatchObject({
      conversationId: 'conversation-1',
      senderId: 'user-1',
      preview: 'Hello from real-time test',
    });
    await expect(intruderMessage).resolves.toBeUndefined();
  });

  it('broadcasts typing indicators and read receipts with the authenticated sender id', async () => {
    const sender = await connectClient('user-1');
    const receiver = await connectClient('user-2');

    sender.emit('join:conversation', 'conversation-1');
    receiver.emit('join:conversation', 'conversation-1');
    await waitForRoomMembers('conversation:conversation-1', [
      connectedSocketId(sender),
      connectedSocketId(receiver),
    ]);

    const typingEvent = waitForEvent<TypingPayload>(receiver, 'typing');
    sender.emit('typing', {
      conversationId: 'conversation-1',
      userId: 'spoofed-user',
      isTyping: true,
    });

    await expect(typingEvent).resolves.toEqual({
      conversationId: 'conversation-1',
      userId: 'user-1',
      isTyping: true,
    });

    const readReceiptEvent = waitForEvent<ReadReceiptPayload>(receiver, 'read:receipt');
    sender.emit('read:receipt', {
      conversationId: 'conversation-1',
      userId: 'spoofed-user',
      lastReadMessageId: 'message-1',
    });

    await expect(readReceiptEvent).resolves.toEqual({
      conversationId: 'conversation-1',
      userId: 'user-1',
      lastReadMessageId: 'message-1',
    });
  });
});
