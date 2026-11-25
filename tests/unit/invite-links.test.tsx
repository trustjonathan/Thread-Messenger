import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  getMyInviteCode,
  regenerateInviteCode,
  resolveInvite,
  redeemInvite,
} from '@/lib/api';
import {
  setPendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
} from '@/lib/inviteStorage';
import InviteLandingPage from '@/features/invite/InviteLandingPage';
import { InviteFriendsModal } from '@/features/chat/components/InviteFriendsModal';
import { EmptyState } from '@/components/layout/EmptyState';
import { copyTextToClipboard } from '@/lib/clipboard';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

describe('Invite Links Storage & OAuth Redirect Resilience', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    Object.defineProperty(global, 'window', {
      configurable: true,
      writable: true,
      value: {
      localStorage: {
        getItem: (k: string) => mockStore[k] || null,
        setItem: (k: string, v: string) => {
          mockStore[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStore[k];
        },
      },
      },
    });
    clearPendingInviteCode();
  });

  afterEach(() => {
    clearPendingInviteCode();
  });

  it('stores invite code in localStorage and retrieves it after simulated redirect', () => {
    setPendingInviteCode('secureTestCode123');
    expect(getPendingInviteCode()).toBe('secureTestCode123');
  });

  it('clears stored invite code after redemption or manual clear', () => {
    setPendingInviteCode('secureTestCode123');
    clearPendingInviteCode();
    expect(getPendingInviteCode()).toBeNull();
  });

  it('expires pending invite codes after 24 hours', () => {
    const origNow = Date.now;

    // Simulate 25 hours elapsed
    const now = 1000000000;
    const pastTime = now - (25 * 60 * 60 * 1000);

    vi.spyOn(Date, 'now').mockReturnValue(now);
    setPendingInviteCode('expiredCode');
    mockStore['thread_pending_invite_timestamp'] = pastTime.toString();

    expect(getPendingInviteCode()).toBeNull();

    Date.now = origNow;
  });
});

describe('Invite Links API Client Tests', () => {
  it('getMyInviteCode calls get_my_invite_code rpc', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: 'inviteCode99',
      error: null,
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await getMyInviteCode(mockClient);
    expect(mockRpc).toHaveBeenCalledWith('get_my_invite_code');
    expect(res.data).toBe('inviteCode99');
    expect(res.error).toBeNull();
  });

  it('regenerateInviteCode calls regenerate_invite_code rpc', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: 'newRegenCode88',
      error: null,
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await regenerateInviteCode(mockClient);
    expect(mockRpc).toHaveBeenCalledWith('regenerate_invite_code');
    expect(res.data).toBe('newRegenCode88');
    expect(res.error).toBeNull();
  });

  it('resolveInvite returns only { username, displayName, avatarSeed } and strips sensitive IDs', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          username: 'johndoe',
          display_name: 'John Doe',
          avatar_seed: 'seed123',
        },
      ],
      error: null,
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await resolveInvite('testcode1234', mockClient);
    expect(mockRpc).toHaveBeenCalledWith('resolve_invite', { p_code: 'testcode1234' });
    expect(res.data).toEqual({
      username: 'johndoe',
      displayName: 'John Doe',
      avatarSeed: 'seed123',
    });
    // Ensure no sensitive fields leaked
    expect(res.data).not.toHaveProperty('id');
    expect(res.data).not.toHaveProperty('user_id');
    expect(res.data).not.toHaveProperty('email');
  });

  it('resolveInvite maps empty or invalid responses to generic INVALID_INVITE error', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await resolveInvite('badcode', mockClient);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe('INVALID_INVITE');
  });

  it('redeemInvite calls redeem_invite rpc and returns inviter username', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: 'inviter_alice',
      error: null,
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await redeemInvite('validInviteCode', mockClient);
    expect(mockRpc).toHaveBeenCalledWith('redeem_invite', { p_code: 'validInviteCode' });
    expect(res.data).toBe('inviter_alice');
  });

  it('redeemInvite handles generic INVALID_INVITE error on self-invite or block without revealing reason', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'INVALID_INVITE' },
    });
    const mockClient = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

    const res = await redeemInvite('selfOrBlockedCode', mockClient);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe('INVALID_INVITE');
  });
});

describe('Invite Links UI & Modals', () => {
  it('renders InviteFriendsModal with copy and share buttons', () => {
    const html = renderToStaticMarkup(
      <InviteFriendsModal isOpen={true} onClose={() => {}} />
    );
    expect(html).toContain('Invite friends');
    expect(html).toContain('Share this link with anyone you want to chat with on Thread.');
    expect(html).toContain('Note: Anyone with this link can see your name and @username and ask to chat.');
  });

  it('renders EmptyState with "Invite friends to Thread" action button', () => {
    const html = renderToStaticMarkup(
      <EmptyState onInviteClick={() => {}} />
    );
    expect(html).toContain('Select a chat to start messaging');
    expect(html).toContain('Invite friends to Thread');
  });

  it('renders InviteLandingPage structure in MemoryRouter', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/invite/testcode']}>
        <InviteLandingPage />
      </MemoryRouter>
    );
    expect(html).toContain('Checking invite link...');
  });
});

describe('Share API Fallback Handling', () => {
  it('falls back to clipboard copy if navigator.share fails or is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: {
          writeText: writeTextMock,
        },
        share: vi.fn().mockRejectedValue(new Error('AbortError')),
      },
    });

    const link = 'https://thread.app/invite/abc123xyz';
    const res = await copyTextToClipboard(link);
    expect(res.success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith(link);
  });
});


describe('Invite Links SQL Migration & Contract Parity', () => {
  it('verifies 20261125000005_invite_links.sql satisfies all hardened SQL rules', async () => {
    const fs = await import('fs');
    const sql = fs.readFileSync('supabase/migrations/20261125000005_invite_links.sql', 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS private.invite_codes');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('ALTER TABLE private.invite_codes ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE private.invite_codes FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('SET search_path = public, private, pg_temp');
    expect(sql).toContain('extensions.gen_random_bytes');
    expect(sql).toContain('private.check_rate_limit');

    // Alphabet excludes 0, O, 1, l, I
    const alphabetMatch = sql.match(/v_chars text := '([^']+)'/);
    expect(alphabetMatch).not.toBeNull();
    const alphabet = alphabetMatch![1];
    expect(alphabet).not.toContain('0');
    expect(alphabet).not.toContain('O');
    expect(alphabet).not.toContain('1');
    expect(alphabet).not.toContain('l');
    expect(alphabet).not.toContain('I');

    // Grants & Revokes for all 4 RPCs
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_my_invite_code() FROM PUBLIC, anon');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_my_invite_code() TO authenticated');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.regenerate_invite_code() FROM PUBLIC, anon');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.resolve_invite(text) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.resolve_invite(text) TO anon, authenticated');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated');
  });

  it('verifies api.mock.ts exports invite functions with matching behavior', async () => {
    const mockApi = await import('@/lib/api.mock');
    expect(typeof mockApi.getMyInviteCode).toBe('function');
    expect(typeof mockApi.regenerateInviteCode).toBe('function');
    expect(typeof mockApi.resolveInvite).toBe('function');
    expect(typeof mockApi.redeemInvite).toBe('function');

    const first = await mockApi.getMyInviteCode();
    const second = await mockApi.getMyInviteCode();
    expect(first.error).toBeNull();
    expect(first.data).toBe(second.data);

    const regen = await mockApi.regenerateInviteCode();
    expect(regen.error).toBeNull();
    expect(regen.data).not.toBe(first.data);

    // Old code fails
    const oldResolve = await mockApi.resolveInvite(first.data!);
    expect(oldResolve.data).toBeNull();
    expect(oldResolve.error?.code).toBe('INVALID_INVITE');

    // New code resolves only the 3 public fields
    const newResolve = await mockApi.resolveInvite(regen.data!);
    expect(newResolve.error).toBeNull();
    expect(Object.keys(newResolve.data!).sort()).toEqual(['avatarSeed', 'displayName', 'username']);

    // Self-invite refused with generic INVALID_INVITE
    const selfRedeem = await mockApi.redeemInvite(regen.data!);
    expect(selfRedeem.data).toBeNull();
    expect(selfRedeem.error?.code).toBe('INVALID_INVITE');
  });
});
