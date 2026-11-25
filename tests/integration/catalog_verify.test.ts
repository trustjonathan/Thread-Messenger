import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestClient } from './helpers';
import type { Database } from '../../src/types/database';

describe('Catalog verification (local DB mirrors hosted)', () => {
  let anon: SupabaseClient<Database>;

  it('anon cannot execute add_group_members', async () => {
    anon = createTestClient();
    const { error } = await anon.rpc('add_group_members', {
      p_conversation_id: '00000000-0000-0000-0000-000000000000',
      p_usernames: ['test'],
    });
    expect(error).not.toBeNull();
  });

  it('public.is_active_conversation_member no longer exists (moved to private)', async () => {
    const { error } = await (anon as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }> }).rpc('is_active_conversation_member', {
      p_conversation_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).not.toBeNull();
  });
});
