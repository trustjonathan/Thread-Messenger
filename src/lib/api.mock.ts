import type {
  ApiResult,
  BlockedUser,
  ConversationSummary,
  CurrentUser,
  Message,
  MessageCursor,
  PaginatedMessages,
  UserProfilePreview,
} from '../types/api';
import { mapError, newClientId } from './api';
import type * as RealApi from './api';

// Re-export mapError and newClientId so the mock module matches the real API surface
export { mapError, newClientId };

// Simulated latency helper (200 - 400 ms)
const simulateLatency = async (): Promise<void> => {
  const ms = Math.floor(Math.random() * 200) + 200;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

// Seed In-Memory Store
interface MockStore {
  currentUserId: string;
  users: UserProfilePreview[];
  conversations: {
    id: string;
    createdAt: string;
    otherUser: UserProfilePreview;
    lastReadAt: string;
  }[];
  messages: Message[];
  blocks: Set<string>;
}

const mockStore: MockStore = {
  currentUserId: '11111111-1111-1111-1111-111111111111',
  users: [
    { id: '11111111-1111-1111-1111-111111111111', username: 'current_user', displayName: 'Current User' },
    { id: '22222222-2222-2222-2222-222222222222', username: 'alice', displayName: 'Alice Smith' },
    { id: '33333333-3333-3333-3333-333333333333', username: 'bob', displayName: 'Bob Jones' },
    { id: '44444444-4444-4444-4444-444444444444', username: 'charlie', displayName: 'Charlie Brown' },
  ],
  conversations: [
    {
      id: 'conv-1111-2222',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      otherUser: { id: '22222222-2222-2222-2222-222222222222', username: 'alice', displayName: 'Alice Smith' },
      lastReadAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'conv-1111-3333',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      otherUser: { id: '33333333-3333-3333-3333-333333333333', username: 'bob', displayName: 'Bob Jones' },
      lastReadAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'conv-1111-4444',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      otherUser: { id: '44444444-4444-4444-4444-444444444444', username: 'charlie', displayName: 'Charlie Brown' },
      lastReadAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ],
  messages: [
    {
      id: 'msg-seed-1',
      conversationId: 'conv-1111-2222',
      senderId: '22222222-2222-2222-2222-222222222222',
      clientId: 'cid-seed-1',
      body: 'Hey there! How is the new public contract looking?',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'msg-seed-2',
      conversationId: 'conv-1111-2222',
      senderId: '11111111-1111-1111-1111-111111111111',
      clientId: 'cid-seed-2',
      body: 'Small, typed, and rock solid!',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'msg-seed-3',
      conversationId: 'conv-1111-3333',
      senderId: '33333333-3333-3333-3333-333333333333',
      clientId: 'cid-seed-3',
      body: 'Are we testing the error triggers with /fail-rate and /fail-op?',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'msg-seed-4',
      conversationId: 'conv-1111-4444',
      senderId: '44444444-4444-4444-4444-444444444444',
      clientId: 'cid-seed-4',
      body: 'Welcome to Thread Messenger!',
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
  ],
  blocks: new Set<string>(),
};

export async function searchUserByUsername(
  username: string
): Promise<ApiResult<UserProfilePreview | null>> {
  await simulateLatency();
  const clean = username.toLowerCase().trim();
  const match = mockStore.users.find((u) => u.username === clean);
  return { data: match || null, error: null };
}

export async function setUsername(
  username: string
): Promise<ApiResult<void>> {
  await simulateLatency();
  const clean = username.toLowerCase().trim();
  if (!clean || clean.length < 3) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid username format.' } };
  }
  const taken = mockStore.users.some((u) => u.username === clean && u.id !== mockStore.currentUserId);
  if (taken) {
    return { data: null, error: { code: 'USERNAME_TAKEN', message: 'Username is already taken.' } };
  }
  const current = mockStore.users.find((u) => u.id === mockStore.currentUserId);
  if (current) {
    current.username = clean;
  }
  if (mockCurrentUserState) {
    mockCurrentUserState.username = clean;
    mockCurrentUserState.usernameSet = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockCurrentUserState));
      } catch {
        // ignore
      }
    }
    notifyMockAuth();
  }
  return { data: undefined, error: null };
}

export async function getOrCreateDirectConversation(
  otherUserId: string
): Promise<ApiResult<string>> {
  await simulateLatency();
  const existing = mockStore.conversations.find((c) => c.otherUser.id === otherUserId);
  if (existing) {
    return { data: existing.id, error: null };
  }

  const otherUser = mockStore.users.find((u) => u.id === otherUserId);
  if (!otherUser) {
    return { data: null, error: { code: 'OPERATION_FAILED', message: 'Target user not found.' } };
  }

  const newId = `conv-${mockStore.currentUserId.slice(0, 4)}-${otherUserId.slice(0, 4)}`;
  mockStore.conversations.unshift({
    id: newId,
    createdAt: new Date().toISOString(),
    otherUser,
    lastReadAt: new Date().toISOString(),
  });

  return { data: newId, error: null };
}

export async function listConversations(): Promise<ApiResult<ConversationSummary[]>> {
  await simulateLatency();
  const summaries: ConversationSummary[] = mockStore.conversations.map((c) => {
    const convMsgs = mockStore.messages
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const lastMsg = convMsgs[0] || null;
    const unreadCount = convMsgs.filter(
      (m) => m.senderId !== mockStore.currentUserId && new Date(m.createdAt) > new Date(c.lastReadAt)
    ).length;

    return {
      conversationId: c.id,
      createdAt: c.createdAt,
      otherUser: c.otherUser,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body.slice(0, 100),
            senderId: lastMsg.senderId,
            createdAt: lastMsg.createdAt,
          }
        : null,
      unreadCount,
    };
  });

  return { data: summaries, error: null };
}

export async function loadMessages(params: {
  conversationId: string;
  cursor?: MessageCursor;
  limit?: number;
}): Promise<ApiResult<PaginatedMessages>> {
  await simulateLatency();
  const pageSize = Math.min(Math.max(params.limit ?? 30, 1), 50);

  let convMsgs = mockStore.messages
    .filter((m) => m.conversationId === params.conversationId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (params.cursor) {
    const cursorTime = new Date(params.cursor.createdAt).getTime();
    convMsgs = convMsgs.filter((m) => {
      const msgTime = new Date(m.createdAt).getTime();
      return msgTime < cursorTime || (msgTime === cursorTime && m.id < params.cursor!.id);
    });
  }

  const hasMore = convMsgs.length > pageSize;
  const messages = hasMore ? convMsgs.slice(0, pageSize) : convMsgs;
  const last = messages[messages.length - 1];

  return {
    data: {
      messages,
      nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
      hasMore,
    },
    error: null,
  };
}

export async function sendMessage(params: {
  conversationId: string;
  body: string;
  clientId: string;
}): Promise<ApiResult<Message>> {
  await simulateLatency();

  // Test error UI triggers for builders
  if (params.body.includes('/fail-rate')) {
    return { data: null, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Please wait before retrying.' } };
  }
  if (params.body.includes('/fail-op')) {
    return { data: null, error: { code: 'OPERATION_FAILED', message: 'The requested operation could not be completed.' } };
  }
  if (params.body.includes('/fail-net')) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Network connection failed.' } };
  }
  if (params.body.includes('/fail-val')) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid message body.' } };
  }

  // Idempotence check on (senderId, clientId)
  const existing = mockStore.messages.find(
    (m) => m.senderId === mockStore.currentUserId && m.clientId === params.clientId
  );
  if (existing) {
    return { data: existing, error: null };
  }

  const newMsg: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: params.conversationId,
    senderId: mockStore.currentUserId,
    clientId: params.clientId,
    body: params.body.trim(),
    createdAt: new Date().toISOString(),
  };

  mockStore.messages.push(newMsg);
  return { data: newMsg, error: null };
}

export async function markRead(conversationId: string): Promise<ApiResult<void>> {
  await simulateLatency();
  const conv = mockStore.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.lastReadAt = new Date().toISOString();
  }
  return { data: undefined, error: null };
}

export async function blockUser(userId: string): Promise<ApiResult<void>> {
  await simulateLatency();
  mockStore.blocks.add(userId);
  return { data: undefined, error: null };
}

export async function unblockUser(userId: string): Promise<ApiResult<void>> {
  await simulateLatency();
  mockStore.blocks.delete(userId);
  return { data: undefined, error: null };
}

export async function reportContent(_params: {
  messageId?: string;
  userId?: string;
  reason: string;
}): Promise<ApiResult<string>> {
  await simulateLatency();
  return { data: `report-${Date.now()}`, error: null };
}

export async function updateLastSeen(): Promise<ApiResult<void>> {
  await simulateLatency();
  return { data: undefined, error: null };
}

export function subscribeToUserMessages(
  _userId: string,
  onMessage: (message: Message) => void,
  onResync?: () => void
): () => void {
  // Fire initial onResync asynchronously on subscription
  setTimeout(() => {
    onResync?.();
  }, 50);

  // Simulate an incoming peer message every ~20 seconds
  const intervalId = setInterval(() => {
    const activeConv = mockStore.conversations[0];
    if (activeConv) {
      const simulatedIncoming: Message = {
        id: `mock-incoming-${Date.now()}`,
        conversationId: activeConv.id,
        senderId: activeConv.otherUser.id,
        clientId: newClientId(),
        body: `[Simulated Realtime] Message at ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
      };
      mockStore.messages.push(simulatedIncoming);
      onMessage(simulatedIncoming);
    }
  }, 20000);

  return () => {
    clearInterval(intervalId);
  };
}

// ---------------------------------------------------------------------------
// Mock Authentication & User Management (REQ-AUTH-01)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'thread_current_user';

function getInitialUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

let mockCurrentUserState: CurrentUser | null = getInitialUser();

const mockBlockedList: BlockedUser[] = [
  { id: '33333333-3333-3333-3333-333333333333', username: 'bob', displayName: 'Bob Jones' },
];

const mockAuthListeners = new Set<(user: CurrentUser | null) => void>();

function notifyMockAuth() {
  for (const listener of mockAuthListeners) {
    try {
      listener(mockCurrentUserState);
    } catch {
      // ignore
    }
  }
}

export async function signInWithGoogle(): Promise<ApiResult<void>> {
  await simulateLatency();
  mockCurrentUserState = {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'current_user',
    displayName: 'Current User',
    usernameSet: true,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockCurrentUserState));
    } catch {
      // ignore
    }
  }
  notifyMockAuth();
  return { data: undefined, error: null };
}

export async function signOut(): Promise<ApiResult<void>> {
  await simulateLatency();
  mockCurrentUserState = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  notifyMockAuth();
  return { data: undefined, error: null };
}

export async function getCurrentUser(): Promise<ApiResult<CurrentUser | null>> {
  return { data: mockCurrentUserState, error: null };
}

export function onAuthChange(callback: (user: CurrentUser | null) => void): () => void {
  mockAuthListeners.add(callback);
  callback(mockCurrentUserState);
  return () => {
    mockAuthListeners.delete(callback);
  };
}

// ---------------------------------------------------------------------------
// Mock Settings Functions (REQ-SETTINGS-01, REQ-SETTINGS-02)
// ---------------------------------------------------------------------------

export async function updateDisplayName(displayName: string): Promise<ApiResult<void>> {
  await simulateLatency();
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 50) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Display name must be between 1 and 50 characters.' },
    };
  }
  if (!mockCurrentUserState) {
    return { data: null, error: { code: 'UNAUTHENTICATED', message: 'User is not signed in.' } };
  }
  mockCurrentUserState.displayName = trimmed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockCurrentUserState));
    } catch {
      // ignore
    }
  }
  notifyMockAuth();
  return { data: undefined, error: null };
}

export async function listBlockedUsers(): Promise<ApiResult<BlockedUser[]>> {
  await simulateLatency();
  return { data: [...mockBlockedList], error: null };
}

// ---------------------------------------------------------------------------
// Compile-time surface parity guard.
// If api.mock.ts is missing any export from api.ts, TypeScript will error here.
// ---------------------------------------------------------------------------
const _mockSurface = {
  mapError,
  newClientId,
  searchUserByUsername,
  setUsername,
  getOrCreateDirectConversation,
  listConversations,
  loadMessages,
  sendMessage,
  markRead,
  blockUser,
  unblockUser,
  reportContent,
  updateLastSeen,
  subscribeToUserMessages,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthChange,
  updateDisplayName,
  listBlockedUsers,
} satisfies typeof RealApi;

void _mockSurface;
