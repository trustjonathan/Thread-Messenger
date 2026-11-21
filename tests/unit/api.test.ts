import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapError,
  loadMessages,
  sendMessage,
  subscribeToUserMessages,
  newClientId,
} from '../../src/lib/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

describe('API Unit Tests (Mocked Client)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Error Mapping', () => {
    it('maps SQLSTATE 28000 to UNAUTHENTICATED', () => {
      const err = mapError({ code: '28000', message: 'Not authenticated' });
      expect(err.code).toBe('UNAUTHENTICATED');
    });

    it('maps message containing UNAUTHENTICATED to UNAUTHENTICATED', () => {
      const err = mapError({ message: 'Error: UNAUTHENTICATED' });
      expect(err.code).toBe('UNAUTHENTICATED');
    });

    it('maps OPERATION_FAILED to OPERATION_FAILED', () => {
      const err = mapError({ message: 'P0001: OPERATION_FAILED' });
      expect(err.code).toBe('OPERATION_FAILED');
    });

    it('maps RATE_LIMITED to RATE_LIMITED', () => {
      const err = mapError({ message: 'P0001: RATE_LIMITED' });
      expect(err.code).toBe('RATE_LIMITED');
    });

    it('maps VALIDATION_ERROR to VALIDATION_ERROR', () => {
      const err = mapError({ message: 'P0001: VALIDATION_ERROR' });
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('maps USERNAME_TAKEN to USERNAME_TAKEN', () => {
      const err = mapError({ message: 'P0001: USERNAME_TAKEN' });
      expect(err.code).toBe('USERNAME_TAKEN');
    });

    it('maps USERNAME_ALREADY_SET to USERNAME_ALREADY_SET', () => {
      const err = mapError({ message: 'P0001: USERNAME_ALREADY_SET' });
      expect(err.code).toBe('USERNAME_ALREADY_SET');
    });

    it('maps USERNAME_RESERVED to USERNAME_RESERVED', () => {
      const err = mapError({ message: 'P0001: USERNAME_RESERVED' });
      expect(err.code).toBe('USERNAME_RESERVED');
    });

    it('maps TypeError fetch failure to NETWORK_ERROR', () => {
      const err = mapError(new TypeError('Failed to fetch'));
      expect(err.code).toBe('NETWORK_ERROR');
    });

    it('maps unknown internal errors to generic UNKNOWN_ERROR', () => {
      const internalErr = { code: '42P01', message: 'relation "secret_table" does not exist' };
      const err = mapError(internalErr);
      expect(err.code).toBe('UNKNOWN_ERROR');
      expect(err.message).toBe('An unexpected error occurred.');
      expect(err.details).toBe(internalErr);
    });
  });

  describe('newClientId', () => {
    it('generates a valid UUID string', () => {
      const cid = newClientId();
      expect(cid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('loadMessages pagination and clamping', () => {
    it('clamps limit to maximum 50 and handles hasMore with nextCursor', async () => {
      const mockRows = Array.from({ length: 51 }, (_, i) => ({
        id: `msg-${51 - i}`,
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        client_id: `cid-${51 - i}`,
        body: `Body ${51 - i}`,
        created_at: new Date(1700000000000 + (51 - i) * 1000).toISOString(),
      }));

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((limitCount: number) => {
          expect(limitCount).toBe(51); // 50 clamped + 1
          return Promise.resolve({ data: mockRows, error: null });
        }),
      };

      const mockClient = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient<Database>;

      const result = await loadMessages(
        { conversationId: 'conv-1', limit: 100 },
        mockClient
      );

      expect(result.error).toBeNull();
      expect(result.data?.messages.length).toBe(50);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.nextCursor).toEqual({
        id: 'msg-2',
        createdAt: mockRows[49].created_at,
      });
    });

    it('clamps limit below 1 to 1', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((limitCount: number) => {
          expect(limitCount).toBe(2); // 1 clamped + 1
          return Promise.resolve({ data: [], error: null });
        }),
      };

      const mockClient = {
        from: vi.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient<Database>;

      const result = await loadMessages(
        { conversationId: 'conv-1', limit: -5 },
        mockClient
      );

      expect(result.error).toBeNull();
      expect(result.data?.messages).toEqual([]);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.nextCursor).toBeNull();
    });
  });

  describe('sendMessage idempotent return', () => {
    it('returns the message payload cleanly on duplicate client_id', async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            id: 'original-msg-id',
            conversation_id: 'conv-1',
            sender_id: 'sender-1',
            client_id: 'client-uuid-1',
            body: 'Original message text',
            created_at: '2026-11-21T12:00:00Z',
          },
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const res = await sendMessage(
        {
          conversationId: 'conv-1',
          body: 'Changed text attempt',
          clientId: 'client-uuid-1',
        },
        mockClient
      );

      expect(res.error).toBeNull();
      expect(res.data?.id).toBe('original-msg-id');
      expect(res.data?.body).toBe('Original message text');
    });
  });

  describe('subscribeToUserMessages cleanup', () => {
    it('registers event listeners and removes them on unsubscribe', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
      };

      const mockClient = {
        channel: vi.fn().mockReturnValue(mockChannel),
        removeChannel: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      const mockDoc = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        visibilityState: 'visible',
      };
      const mockWin = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('document', mockDoc);
      vi.stubGlobal('window', mockWin);

      const unsubscribe = subscribeToUserMessages(
        'user-1',
        vi.fn(),
        vi.fn(),
        mockClient
      );

      expect(mockDoc.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockWin.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));

      // Call cleanup
      unsubscribe();

      expect(mockDoc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockWin.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
