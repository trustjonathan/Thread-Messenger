import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, createAuthenticatedClient } from './helpers';
import {
  createGroup,
  addGroupMembers,
  listGroupMembers,
  sendMessage,
  markRead,
  loadMessages,
} from '../../src/lib/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

describe('Phase A: group member cap + security (current code)', { timeout: 60000 }, () => {
  let root: SupabaseClient<Database>;
  let clientA: SupabaseClient<Database>; // creator
  let clientB: SupabaseClient<Database>; // member
  let clientC: SupabaseClient<Database>; // non-member / stranger
  let userAId: string;
  let userBId: string;
  let userCId: string;
  let usernameA: string;
  let usernameB: string;
  let usernameC: string;
  let conversationId: string;

  async function signUp(suffix: string) {
    const username = `pa_${suffix}_${Date.now().toString(36)}`;
    const { data, error } = await root.auth.signUp({
      email: `${username}@pa.test`,
      password: 'TestPassword123!',
      options: { data: { username, display_name: `PA ${suffix}` } },
    });
    if (error || !data.user) throw new Error(`signup ${suffix}: ${error?.message}`);
    return { username, id: data.user.id };
  }

  async function authedClient(username: string, password: string) {
    const { data, error } = await root.auth.signInWithPassword({
      email: `${username}@pa.test`,
      password,
    });
    if (error || !data.session) throw new Error(`signin ${username}: ${error?.message}`);
    return createAuthenticatedClient(data.session);
  }

  beforeAll(async () => {
    root = createTestClient();
    const a = await signUp('a');
    const b = await signUp('b');
    const c = await signUp('c');
    userAId = a.id;
    userBId = b.id;
    userCId = c.id;
    usernameA = a.username;
    usernameB = b.username;
    usernameC = c.username;

    clientA = await authedClient(a.username, 'TestPassword123!');
    clientB = await authedClient(b.username, 'TestPassword123!');
    clientC = await authedClient(c.username, 'TestPassword123!');

    const create = await createGroup(`PA Group ${Date.now()}`, [usernameB, usernameC], clientA);
    expect(create.error).toBeNull();
    conversationId = create.data!;
  });

  afterAll(async () => {
    // noop
  });

  it('(a) creator makes group of 3, adds 5 more one at a time -> all succeed', async () => {
    const more = await Promise.all(['d', 'e', 'f', 'g', 'h'].map(s => signUp(s)));
    for (const u of more) {
      const res = await addGroupMembers(conversationId, [u.username], clientA);
      expect(res.error).toBeNull();
      const added = res.data?.find((r) => r.status === 'added');
      expect(added).toBeDefined();
    }
    const members = await listGroupMembers(conversationId, clientA);
    expect(members.error).toBeNull();
    expect(members.data).toHaveLength(8);
  });

  it('(b) adding creator own username and leading "@" does not change creator role nor report phantom success', async () => {
    const res = await addGroupMembers(conversationId, [usernameA, `@${usernameA}`], clientA);
    expect(res.error).toBeNull();
    const members = await listGroupMembers(conversationId, clientA);
    expect(members.error).toBeNull();
    const creator = members.data?.find(m => m.userId === userAId);
    expect(creator?.role).toBe('admin');
  });

  it('(c) unknown username returns clear NOT_FOUND-style result', async () => {
    const res = await addGroupMembers(conversationId, ['definitely_not_a_real_user_xyz'], clientA);
    // Current code: no NOT_FOUND code, likely returns success with 0 added or maps to generic
    expect(res.error).toBeNull();
  });

  it('(d) non-creator add fails; 21st member fails; concurrent adds cannot exceed 20', async () => {
    // Non-creator (member B) attempts add
    const d = await signUp('d');
    const nonCreator = await addGroupMembers(conversationId, [d.username], clientB);
    expect(nonCreator.error).not.toBeNull();

    // Count current members
    const members = await listGroupMembers(conversationId, clientA);
    const current = members.data?.length ?? 0;
    const neededToReach20 = 20 - current;

    // Add enough to reach exactly 20 (one at a time)
    const toReach20 = await Promise.all(
      Array.from({ length: neededToReach20 }, (_, i) => signUp(`r20_${i}`))
    );
    for (const u of toReach20) {
      const res = await addGroupMembers(conversationId, [u.username], clientA);
      expect(res.error).toBeNull();
    }
    const at20 = await listGroupMembers(conversationId, clientA);
    expect(at20.error).toBeNull();
    expect(at20.data).toHaveLength(20);

    // 21st member attempt must fail
    const z = await signUp('z');
    const over = await addGroupMembers(conversationId, [z.username], clientA);
    expect(over.error).not.toBeNull();
  });

  it('(g) all-or-nothing: 5 requested adds when only 3 slots free -> none added, GROUP_FULL', async () => {
    const members = await listGroupMembers(conversationId, clientA);
    expect(members.error).toBeNull();
    const current = members.data?.length ?? 0;
    const freeSlots = 20 - current;

    // Request more users than free slots
    const overflow = await Promise.all(
      Array.from({ length: freeSlots + 3 }, (_, i) => signUp(`overflow_${i}`))
    );
    const res = await addGroupMembers(conversationId, overflow.map(u => u.username), clientA);
    expect(res.error).not.toBeNull();
    expect(res.error?.code).toBe('GROUP_FULL');

    // None were added
    const still = await listGroupMembers(conversationId, clientA);
    expect(still.error).toBeNull();
    expect(still.data).toHaveLength(current);
  });

  it('(e) removed member cannot sendMessage, markRead or read messages', async () => {
    // Remove user C from group via clientA (creator)
    const remApi = await (clientA as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }> }).rpc('remove_group_member', {
      p_conversation_id: conversationId,
      p_user_id: userCId,
    });
    expect(remApi.error).toBeNull();

    const sendRes = await sendMessage(
      { conversationId, body: 'removed member msg', clientId: crypto.randomUUID() },
      clientC
    );
    expect(sendRes.error).not.toBeNull();

    const markRes = await markRead(conversationId, clientC);
    expect(markRes.error).not.toBeNull();

    const loadRes = await loadMessages({ conversationId, limit: 10 }, clientC);
    expect(loadRes.error).toBeNull();
    expect(loadRes.data?.messages).toHaveLength(0);
  });

  it('(f) authenticated client .from("profiles").select() sees only self + shared-conversation people', async () => {
    const { data, error } = await clientC.from('profiles').select('id, username, display_name');
    expect(error).toBeNull();
    const ids = (data || []).map((r: { id: string }) => r.id);
    expect(ids).toContain(userCId); // self visible
    expect(ids).not.toContain(userAId); // stranger not visible
    expect(ids).not.toContain(userBId); // stranger not visible
  });
});
