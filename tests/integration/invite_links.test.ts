import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createTestClient, createAuthenticatedClient, getLocalSupabaseConfig } from './helpers';
import {
  getMyInviteCode,
  regenerateInviteCode,
  resolveInvite,
  redeemInvite,
  blockUser,
  unblockUser,
  listConversations,
} from '../../src/lib/api';
import type { Database } from '../../src/types/database';

describe('Invite Links Live DB Integration Tests', { timeout: 40000 }, () => {
  let anonClient: SupabaseClient<Database>;
  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;
  let usernameA: string;
  let usernameB: string;

  let codeA1: string;
  let codeA2: string;

  beforeAll(async () => {
    anonClient = createTestClient();
    const ts = Date.now().toString(36);
    usernameA = `inv_a_${ts}`;
    usernameB = `inv_b_${ts}`;

    const { data: authA, error: errA } = await anonClient.auth.signUp({
      email: `${usernameA}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: usernameA, display_name: 'Inviter A' } },
    });
    if (errA || !authA.user || !authA.session) {
      throw new Error(`SignUp A failed: ${errA?.message}`);
    }
    userAId = authA.user.id;
    clientA = await createAuthenticatedClient(authA.session);

    const { data: authB, error: errB } = await anonClient.auth.signUp({
      email: `${usernameB}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: usernameB, display_name: 'Invitee B' } },
    });
    if (errB || !authB.user || !authB.session) {
      throw new Error(`SignUp B failed: ${errB?.message}`);
    }
    userBId = authB.user.id;
    clientB = await createAuthenticatedClient(authB.session);
  });

  it('get_my_invite_code returns the same code twice, >= 10 chars, no look-alikes, not derived from userId', async () => {
    const first = await getMyInviteCode(clientA);
    const second = await getMyInviteCode(clientA);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toBeTruthy();
    expect(first.data).toBe(second.data);

    codeA1 = first.data!;
    expect(codeA1.length).toBeGreaterThanOrEqual(10);
    expect(codeA1).toMatch(/^[23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
    expect(codeA1).not.toContain(userAId.slice(0, 6));
    expect(codeA1).not.toContain(usernameA);
  });

  it('resolve_invite (anon) returns only { username, displayName, avatarSeed }', async () => {
    const res = await resolveInvite(codeA1, anonClient);
    expect(res.error).toBeNull();
    expect(res.data).toBeTruthy();
    expect(res.data!.username).toBe(usernameA);
    expect(res.data!.displayName).toBe('Inviter A');
    expect(Object.keys(res.data!).sort()).toEqual(['avatarSeed', 'displayName', 'username']);
  });

  it('resolve_invite returns identical INVALID_INVITE for invalid and malformed codes', async () => {
    const bad1 = await resolveInvite('nonexistent_code_999', anonClient);
    const bad2 = await resolveInvite('short', anonClient);
    const bad3 = await resolveInvite('0O1lInvalidLookalike', anonClient);

    expect(bad1.data).toBeNull();
    expect(bad2.data).toBeNull();
    expect(bad3.data).toBeNull();

    expect(bad1.error?.code).toBe('INVALID_INVITE');
    expect(bad2.error?.code).toBe('INVALID_INVITE');
    expect(bad3.error?.code).toBe('INVALID_INVITE');
    expect(bad1.error?.message).toBe(bad2.error?.message);
    expect(bad2.error?.message).toBe(bad3.error?.message);
  });

  it('regenerate_invite_code replaces code and immediately invalidates the old one', async () => {
    const regen = await regenerateInviteCode(clientA);
    expect(regen.error).toBeNull();
    expect(regen.data).toBeTruthy();
    codeA2 = regen.data!;
    expect(codeA2).not.toBe(codeA1);

    const oldResolve = await resolveInvite(codeA1, anonClient);
    expect(oldResolve.data).toBeNull();
    expect(oldResolve.error?.code).toBe('INVALID_INVITE');

    const oldRedeem = await redeemInvite(codeA1, clientB);
    expect(oldRedeem.data).toBeNull();
    expect(oldRedeem.error?.code).toBe('INVALID_INVITE');

    const newResolve = await resolveInvite(codeA2, anonClient);
    expect(newResolve.error).toBeNull();
    expect(newResolve.data?.username).toBe(usernameA);
  });

  it('redeem_invite refuses self-invite with generic INVALID_INVITE', async () => {
    const selfRes = await redeemInvite(codeA2, clientA);
    expect(selfRes.data).toBeNull();
    expect(selfRes.error?.code).toBe('INVALID_INVITE');
  });

  it('redeem_invite refuses blocked pair (either direction) with generic INVALID_INVITE', async () => {
    const blk = await blockUser(userBId, clientA);
    expect(blk.error).toBeNull();

    const redeemBlocked = await redeemInvite(codeA2, clientB);
    expect(redeemBlocked.data).toBeNull();
    expect(redeemBlocked.error?.code).toBe('INVALID_INVITE');

    const unblk = await unblockUser(userBId, clientA);
    expect(unblk.error).toBeNull();
  });

  it('redeem_invite succeeds for valid unblocked pair and creates NO conversation', async () => {
    const convsBefore = await listConversations(clientB);
    expect(convsBefore.error).toBeNull();

    const redeemOk = await redeemInvite(codeA2, clientB);
    expect(redeemOk.error).toBeNull();
    expect(redeemOk.data).toBe(usernameA);

    const convsAfter = await listConversations(clientB);
    expect(convsAfter.error).toBeNull();
    expect(convsAfter.data?.length).toBe(convsBefore.data?.length);
  });

  it('deleting inviter account cascades and deletes invite code', async () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
    const { url } = getLocalSupabaseConfig();
    const adminClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: delErr } = await adminClient.auth.admin.deleteUser(userAId);
    expect(delErr).toBeNull();

    const afterDelete = await resolveInvite(codeA2, anonClient);
    expect(afterDelete.data).toBeNull();
    expect(afterDelete.error?.code).toBe('INVALID_INVITE');
  });

  it('resolve_invite rate limit trips after exceeding 20 calls in 10 minutes', async () => {
    let tripped = false;
    for (let i = 0; i < 25; i++) {
      const res = await resolveInvite(codeA2, clientB);
      if (res.error?.code === 'RATE_LIMITED') {
        tripped = true;
        break;
      }
    }
    expect(tripped).toBe(true);
  });
});
