import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  flushQueuedMessages,
  getCurrentUser,
  listConversations,
  loadMessages,
  sendMessage,
} from '../../src/lib/api';
import type { Database } from '../../src/types/database';
import type { CurrentUser, Message } from '../../src/types/api';

const offlineCache = vi.hoisted(() => ({
  cacheConversations: vi.fn(),
  cacheMessages: vi.fn(),
  cacheProfile: vi.fn(),
  completeQueuedMessage: vi.fn(),
  failQueuedMessage: vi.fn(),
  getCachedConversations: vi.fn(),
  getCachedMessages: vi.fn(),
  getCachedProfile: vi.fn(),
  getQueuedMessages: vi.fn(),
  queueMessage: vi.fn(),
}));

vi.mock('../../src/lib/offlineCache', () => offlineCache);

const cachedProfile: CurrentUser = {
  id: 'user-1',
  username: 'threaduser',
  displayName: 'Thread User',
  usernameSet: true,
};

const cachedConversations = [{
  conversationId: 'conversation-1',
  createdAt: '2026-03-01T10:00:00.000Z',
  kind: 'direct' as const,
  title: null,
  description: null,
  createdBy: null,
  otherUser: null,
  memberCount: 2,
  lastMessage: null,
  unreadCount: 0,
}];

function makeAuthenticatedClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'user@example.com' } } },
        error: null,
      }),
      getUser: vi.fn(),
    },
    ...overrides,
  } as unknown as SupabaseClient<Database>;
}

describe('offline-first API behavior', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    offlineCache.cacheConversations.mockResolvedValue(undefined);
    offlineCache.cacheMessages.mockResolvedValue(undefined);
    offlineCache.cacheProfile.mockResolvedValue(undefined);
    offlineCache.completeQueuedMessage.mockResolvedValue(undefined);
    offlineCache.failQueuedMessage.mockResolvedValue(undefined);
    offlineCache.getCachedConversations.mockResolvedValue(cachedConversations);
    offlineCache.getCachedMessages.mockResolvedValue({
      messages: [],
      nextCursor: null,
      hasMore: false,
    });
    offlineCache.getCachedProfile.mockResolvedValue(cachedProfile);
    offlineCache.getQueuedMessages.mockResolvedValue([]);
    offlineCache.queueMessage.mockImplementation(async (_userId: string, message: Message) => ({
      ...message,
      id: `offline:${message.clientId}`,
      deliveryStatus: 'queued',
    }));
  });

  it('uses the cached profile when the saved session is valid but the profile request is offline', async () => {
    const client = makeAuthenticatedClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new TypeError('Failed to fetch'),
        }),
      }),
    });

    const result = await getCurrentUser(client);

    expect(result).toEqual({ data: cachedProfile, error: null });
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(offlineCache.getCachedProfile).toHaveBeenCalledWith('user-1');
  });

  it('serves cached conversations after a network error', async () => {
    const client = makeAuthenticatedClient({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new TypeError('Failed to fetch'),
      }),
    });

    const result = await listConversations(client);

    expect(result).toEqual({ data: cachedConversations, error: null });
    expect(offlineCache.getCachedConversations).toHaveBeenCalledWith('user-1');
  });

  it('serves cached messages when loading a conversation offline', async () => {
    const cachedPage = {
      messages: [{
        id: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'user-1',
        clientId: 'client-1',
        body: 'Cached message',
        createdAt: '2026-03-01T10:00:00.000Z',
      }],
      nextCursor: null,
      hasMore: false,
    };
    offlineCache.getCachedMessages.mockResolvedValue(cachedPage);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: new TypeError('Failed to fetch'),
      }),
    };
    const client = makeAuthenticatedClient({ from: vi.fn().mockReturnValue(query) });

    const result = await loadMessages({ conversationId: 'conversation-1' }, client);

    expect(result).toEqual({ data: cachedPage, error: null });
    expect(offlineCache.getCachedMessages).toHaveBeenCalledWith(
      'user-1',
      'conversation-1',
      undefined,
      30
    );
  });

  it('queues an offline send with the original idempotency client ID', async () => {
    const client = makeAuthenticatedClient({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new TypeError('Failed to fetch'),
      }),
    });

    const result = await sendMessage({
      conversationId: 'conversation-1',
      body: 'Queued message',
      clientId: 'stable-client-id',
    }, client);

    expect(result.data?.deliveryStatus).toBe('queued');
    expect(offlineCache.queueMessage).toHaveBeenCalledWith('user-1', expect.objectContaining({
      conversationId: 'conversation-1',
      body: 'Queued message',
      clientId: 'stable-client-id',
      senderId: 'user-1',
    }));
  });

  it('also queues a send when the network request throws', async () => {
    const client = makeAuthenticatedClient({
      rpc: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    const result = await sendMessage({
      conversationId: 'conversation-1',
      body: 'Thrown network error',
      clientId: 'stable-client-id',
    }, client);

    expect(result.data?.deliveryStatus).toBe('queued');
    expect(offlineCache.queueMessage).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ clientId: 'stable-client-id' })
    );
  });

  it('replays queued messages using their original client IDs', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const queued: Message = {
      id: 'offline:stable-client-id',
      conversationId: 'conversation-1',
      senderId: 'user-1',
      clientId: 'stable-client-id',
      body: 'Queued message',
      createdAt: '2026-03-01T10:00:00.000Z',
      deliveryStatus: 'queued',
    };
    offlineCache.getQueuedMessages.mockResolvedValue([queued]);

    const client = makeAuthenticatedClient({
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: 'server-message-1',
          conversation_id: 'conversation-1',
          sender_id: 'user-1',
          client_id: 'stable-client-id',
          body: 'Queued message',
          created_at: '2026-03-01T10:00:00.000Z',
        },
        error: null,
      }),
    });

    const result = await flushQueuedMessages('user-1', client);

    expect(result).toEqual({ data: 1, error: null });
    expect(client.rpc).toHaveBeenCalledWith('send_message', expect.objectContaining({
      p_client_id: 'stable-client-id',
    }));
    expect(offlineCache.completeQueuedMessage).toHaveBeenCalledWith(
      'user-1',
      'stable-client-id',
      expect.objectContaining({ id: 'server-message-1' })
    );
  });
});
