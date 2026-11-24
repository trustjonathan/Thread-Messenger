import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from './supabaseClient';
import type { Database } from '../types/database';
import type {
  ApiError,
  ApiResult,
  BlockedUser,
  ConversationSummary,
  CurrentUser,
  GroupMember,
  Message,
  MessageCursor,
  PaginatedMessages,
  UserProfilePreview,
} from '../types/api';

/**
 * Maps raw PostgREST / Supabase / network errors to strict typed ApiErrors.
 * Raw database and system internals are never leaked in error messages.
 */
export function mapError(err: unknown): ApiError {
  if (!err) {
    return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred.' };
  }

  // Handle network / fetch failures
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed. Please check your internet connection.',
      details: err,
    };
  }

  const e = err as { code?: string; message?: string; details?: unknown; hint?: string };
  const msg = e.message || '';
  const codeStr = e.code || '';

  if (codeStr === '28000' || msg.includes('UNAUTHENTICATED')) {
    return {
      code: 'UNAUTHENTICATED',
      message: 'You must be signed in to perform this action.',
      details: err,
    };
  }
  if (msg.includes('OPERATION_FAILED')) {
    return {
      code: 'OPERATION_FAILED',
      message: 'The requested operation could not be completed.',
      details: err,
    };
  }
  if (msg.includes('RATE_LIMITED')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Please wait before retrying.',
      details: err,
    };
  }
  if (msg.includes('VALIDATION_ERROR')) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input provided.',
      details: err,
    };
  }
  if (msg.includes('USERNAME_TAKEN')) {
    return {
      code: 'USERNAME_TAKEN',
      message: 'This username is already taken.',
      details: err,
    };
  }
  if (msg.includes('USERNAME_ALREADY_SET')) {
    return {
      code: 'USERNAME_ALREADY_SET',
      message: 'Username has already been chosen and cannot be changed.',
      details: err,
    };
  }
  if (msg.includes('USERNAME_RESERVED')) {
    return {
      code: 'USERNAME_RESERVED',
      message: 'This username is reserved and cannot be chosen.',
      details: err,
    };
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed.',
      details: err,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred.',
    details: err,
  };
}

/**
 * Generates an idempotent client UUID for message delivery tracking.
 */
export function newClientId(): string {
  return crypto.randomUUID();
}

/**
 * Searches for a user by exact lowercase username.
 */
export async function searchUserByUsername(
  username: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<UserProfilePreview | null>> {
  try {
    const { data, error } = await client.rpc('search_user_by_username', {
      p_username: username,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    if (!data || data.length === 0) {
      return { data: null, error: null };
    }

    const first = data[0];
    return {
      data: {
        id: first.id,
        username: first.username,
        displayName: first.display_name,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Sets the username for the authenticated user once.
 */
export async function setUsername(
  username: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('set_username', {
      p_username: username,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    emitAuthChange(client);
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Gets or atomically creates the canonical direct conversation with another user.
 */
export async function getOrCreateDirectConversation(
  otherUserId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('get_or_create_direct_conversation', {
      p_other_user_id: otherUserId,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Lists all conversations for the authenticated user with preview and unread counts.
 */
export async function listConversations(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<ConversationSummary[]>> {
  try {
    const { data, error } = await client.rpc('list_conversations');

    if (error) {
      return { data: null, error: mapError(error) };
    }

    const summaries: ConversationSummary[] = (data || []).map((row) => ({
      conversationId: row.conversation_id,
      createdAt: row.created_at,
      kind: row.kind === 'group' ? 'group' : 'direct',
      title: row.title ?? null,
      description: row.description ?? null,
      createdBy: row.created_by ?? null,
      otherUser: row.other_user_id
        ? {
            id: row.other_user_id,
            username: row.other_username ?? '',
            displayName: row.other_display_name ?? '',
          }
        : null,
      memberCount: Number(row.member_count ?? 0),
      lastMessage: row.last_message_id
        ? {
            id: row.last_message_id,
            body: row.last_message_body,
            senderId: row.last_message_sender_id,
            createdAt: row.last_message_created_at,
          }
        : null,
      unreadCount: Number(row.unread_count),
    }));

    return { data: summaries, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Loads messages for a conversation using keyset cursor pagination (created_at, id) descending.
 * Limit is clamped between 1 and 50 (default 30).
 */
export async function loadMessages(
  params: {
    conversationId: string;
    cursor?: MessageCursor;
    limit?: number;
  },
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<PaginatedMessages>> {
  try {
    const pageSize = Math.min(Math.max(params.limit ?? 30, 1), 50);

    let query = client
      .from('messages')
      .select('id, conversation_id, sender_id, client_id, body, created_at')
      .eq('conversation_id', params.conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);

    if (params.cursor) {
      query = query.or(
        `created_at.lt.${params.cursor.createdAt},and(created_at.eq.${params.cursor.createdAt},id.lt.${params.cursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: mapError(error) };
    }

    const rawRows = data || [];
    const hasMore = rawRows.length > pageSize;
    const rows = hasMore ? rawRows.slice(0, pageSize) : rawRows;

    const messages: Message[] = rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      clientId: r.client_id,
      body: r.body,
      createdAt: r.created_at,
    }));

    const last = messages[messages.length - 1];
    const nextCursor: MessageCursor | null = hasMore && last
      ? { createdAt: last.createdAt, id: last.id }
      : null;

    return {
      data: {
        messages,
        nextCursor,
        hasMore,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Sends a message idempotently using send_message RPC.
 * Duplicate (sender_id, client_id) returns the original message cleanly without error.
 */
export async function sendMessage(
  params: {
    conversationId: string;
    body: string;
    clientId: string;
  },
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<Message>> {
  try {
    const { data, error } = await client.rpc('send_message', {
      p_conversation_id: params.conversationId,
      p_body: params.body,
      p_client_id: params.clientId,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return {
      data: {
        id: data.id,
        conversationId: data.conversation_id,
        senderId: data.sender_id,
        clientId: data.client_id,
        body: data.body,
        createdAt: data.created_at,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Updates last_read_at for the authenticated user in the specified conversation.
 */
export async function markRead(
  conversationId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('mark_read', {
      p_conversation_id: conversationId,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Blocks another user.
 */
export async function blockUser(
  userId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return {
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'User is not signed in.' },
      };
    }

    const { error } = await client.from('blocks').insert({
      blocker_id: userData.user.id,
      blocked_id: userId,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Unblocks another user.
 */
export async function unblockUser(
  userId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.from('blocks').delete().eq('blocked_id', userId);

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Submits an abuse report for a message or user.
 */
export async function reportContent(
  params: {
    messageId?: string;
    userId?: string;
    reason: string;
  },
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('report_content', {
      p_message_id: params.messageId ?? (null as unknown as string),
      p_user_id: params.userId ?? (null as unknown as string),
      p_reason: params.reason,
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Updates the user's last_seen_at timestamp (rate limited server-side to 1 per 10s).
 */
export async function updateLastSeen(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('update_last_seen');

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Subscribes to real-time incoming messages for the user.
 *
 * IMPORTANT NOTE FOR UI BUILDERS:
 * Incoming realtime messages can duplicate the user's own optimistic sends and must
 * be de-duplicated by `clientId`.
 *
 * This function owns gap recovery: it triggers `onResync` on initial subscription,
 * on reconnection, on tab visibility change to visible, and on window focus.
 * UI builders should place their conversation/message refetch logic inside `onResync`.
 *
 * The underlying transport (Postgres Changes) is encapsulated and may be swapped for
 * Broadcast in future scaling revisions without breaking this signature.
 */
export function subscribeToUserMessages(
  userId: string,
  onMessage: (message: Message) => void,
  onResync?: () => void,
  client: SupabaseClient<Database> = defaultClient
): () => void {
  const channelName = `user-messages:${userId}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const raw = payload.new as Database['public']['Tables']['messages']['Row'];
        if (raw) {
          onMessage({
            id: raw.id,
            conversationId: raw.conversation_id,
            senderId: raw.sender_id,
            clientId: raw.client_id,
            body: raw.body,
            createdAt: raw.created_at,
          });
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onResync?.();
      }
    });

  // Reconnection and gap-recovery event listeners
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      onResync?.();
    }
  };

  const handleWindowFocus = () => {
    onResync?.();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus);
  }

  // Cleanup: removes listeners and unsubscribes channel
  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus);
    }
    channel.unsubscribe();
    client.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Authentication & User Management (REQ-AUTH-01)
// ---------------------------------------------------------------------------

const authListeners = new Set<(user: CurrentUser | null) => void>();

async function emitAuthChange(client: SupabaseClient<Database> = defaultClient): Promise<void> {
  const res = await getCurrentUser(client);
  for (const listener of authListeners) {
    try {
      listener(res.data);
    } catch {
      // ignore
    }
  }
}

/**
 * Initiates Google OAuth sign-in flow.
 */
export async function signInWithGoogle(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/chats`
        : undefined;

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      return { data: null, error: mapError(error) };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Signs out the current user and clears local auth session.
 */
export async function signOut(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return { data: null, error: mapError(error) };
    }
    for (const listener of authListeners) {
      try {
        listener(null);
      } catch {
        // ignore
      }
    }
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Gets the current authenticated user and their profile.
 */
export async function getCurrentUser(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<CurrentUser | null>> {
  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return { data: null, error: null };
    }

    const user = authData.user;
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, username, display_name, username_set, avatar_seed')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return { data: null, error: mapError(profileError) };
    }

    if (profile) {
      return {
        data: {
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          usernameSet: profile.username_set,
          avatarSeed: profile.avatar_seed,
        },
        error: null,
      };
    }

    // Fallback if profile row is still being populated by handle_new_user trigger
    const metadata = user.user_metadata || {};
    return {
      data: {
        id: user.id,
        username: (metadata.username as string) || user.email?.split('@')[0] || 'user',
        displayName: (metadata.full_name as string) || (metadata.name as string) || 'User',
        usernameSet: false,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Subscribes to auth state changes (login, logout, token refresh).
 * The callback is invoked once immediately with the current state,
 * and again each time the auth state changes.
 */
export function onAuthChange(
  callback: (user: CurrentUser | null) => void,
  client: SupabaseClient<Database> = defaultClient
): () => void {
  authListeners.add(callback);

  // Let Supabase's onAuthStateChange be the single source of truth.
  // It fires INITIAL_SESSION on subscribe, so we don't need a separate getCurrentUser call.
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      // Fetch profile to build CurrentUser
      const res = await getCurrentUser(client);
      for (const listener of authListeners) {
        try {
          listener(res.data);
        } catch {
          // ignore
        }
      }
    } else {
      for (const listener of authListeners) {
        try {
          listener(null);
        } catch {
          // ignore
        }
      }
    }
  });

  return () => {
    authListeners.delete(callback);
    subscription.unsubscribe();
  };
}

// ---------------------------------------------------------------------------
// Settings RPCs / Fallbacks (REQ-SETTINGS-01, REQ-SETTINGS-02)
// ---------------------------------------------------------------------------

/**
 * Updates the display name for the current authenticated user.
 */
export async function updateDisplayName(
  displayName: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 50) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Display name must be between 1 and 50 characters.' },
    };
  }

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return {
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'User is not signed in.' },
      };
    }

    const { error } = await client
      .from('profiles')
      .update({
        display_name: trimmed,
      })
      .eq('id', authData.user.id);

    if (error) {
      return { data: null, error: mapError(error) };
    }

    emitAuthChange(client);
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

/**
 * Lists users blocked by the authenticated user.
 */
export async function listBlockedUsers(
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<BlockedUser[]>> {
  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return {
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'User is not signed in.' },
      };
    }

    // Try RPC first if created on database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcRes = await (client as any).rpc('list_blocked_users');
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      return {
        data: rpcRes.data.map((r: { id: string; username: string; display_name: string }) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
        })),
        error: null,
      };
    }

    // Fallback: direct query on blocks joined with profiles
    const { data, error } = await client
      .from('blocks')
      .select('blocked_id, profiles!blocks_blocked_id_fkey(id, username, display_name)')
      .eq('blocker_id', authData.user.id);

    if (error) {
      return { data: null, error: mapError(error) };
    }

    const blocked: BlockedUser[] = [];
    for (const row of data || []) {
      const p = row.profiles as unknown as { id: string; username: string; display_name: string } | null;
      if (p) {
        blocked.push({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
        });
      }
    }

    return { data: blocked, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function createGroup(
  title: string,
  memberUsernames: string[],
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('create_group', {
      p_title: title,
      p_member_usernames: memberUsernames,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: data as string, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function addGroupMembers(
  conversationId: string,
  usernames: string[],
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<number>> {
  try {
    const { data, error } = await client.rpc('add_group_members', {
      p_conversation_id: conversationId,
      p_usernames: usernames,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: Number(data ?? 0), error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function removeGroupMember(
  conversationId: string,
  userId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('remove_group_member', {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function renameGroup(
  conversationId: string,
  title: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('rename_group', {
      p_conversation_id: conversationId,
      p_title: title,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: data as string, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function leaveGroup(
  conversationId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('leave_group', {
      p_conversation_id: conversationId,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function deleteGroup(
  conversationId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('delete_group', {
      p_conversation_id: conversationId,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function listGroupMembers(
  conversationId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<GroupMember[]>> {
  try {
    const { data, error } = await client.rpc('list_group_members', {
      p_conversation_id: conversationId,
    });
    if (error) return { data: null, error: mapError(error) };
    const members: GroupMember[] = (data || []).map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      role: r.role === 'admin' ? 'admin' : 'member',
      joinedAt: r.joined_at,
      lastReadAt: r.last_read_at,
      avatarSeed: r.avatar_seed,
    }));
    return { data: members, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function searchUsersByPrefix(
  query: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<UserProfilePreview[]>> {
  try {
    const { data, error } = await client.rpc('search_users_by_prefix', { p_query: query });
    if (error) return { data: null, error: mapError(error) };
    return {
      data: (data || []).map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, avatarSeed: null })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function searchMessages(
  query: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<Array<{ conversationId: string; messageId: string; body: string; createdAt: string }>>> {
  try {
    const { data, error } = await client.rpc('search_messages', { p_query: query });
    if (error) return { data: null, error: mapError(error) };
    return {
      data: (data || []).map((r) => ({
        conversationId: r.conversation_id,
        messageId: r.message_id,
        body: r.body,
        createdAt: r.created_at,
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function setTyping(
  conversationId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<void>> {
  try {
    const { error } = await client.rpc('set_typing', { p_conversation_id: conversationId });
    if (error) return { data: null, error: mapError(error) };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function updateGroupDescription(
  conversationId: string,
  description: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('update_group_description', {
      p_conversation_id: conversationId,
      p_description: description,
    });
    if (error) return { data: null, error: mapError(error) };
    return { data: (data as string) ?? '', error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}

export async function updateAvatarSeed(
  seed: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<ApiResult<string>> {
  try {
    const { data, error } = await client.rpc('update_avatar_seed', { p_seed: seed });
    if (error) return { data: null, error: mapError(error) };
    return { data: data as string, error: null };
  } catch (err) {
    return { data: null, error: mapError(err) };
  }
}
