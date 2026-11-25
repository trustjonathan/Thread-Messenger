export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'OPERATION_FAILED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'USERNAME_TAKEN'
  | 'USERNAME_ALREADY_SET'
  | 'USERNAME_RESERVED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | 'GROUP_FULL'
  | 'NOT_ALLOWED'
  | 'INVALID_INVITE';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export interface UserProfilePreview {
  id: string;
  username: string;
  displayName: string;
  avatarSeed?: string | null;
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  usernameSet: boolean;
  avatarSeed?: string | null;
}

export type BlockedUser = UserProfilePreview;

export interface ConversationSummary {
  conversationId: string;
  createdAt: string;
  kind: 'direct' | 'group';
  title: string | null;
  description: string | null;
  createdBy: string | null;
  otherUser: UserProfilePreview | null;
  memberCount: number;
  lastMessage: {
    id: string;
    body: string; // Truncated to 100 characters max
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  clientId: string;
  body: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  joinedAt: string;
  lastReadAt: string;
  avatarSeed?: string | null;
}

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: MessageCursor | null;
  hasMore: boolean;
}

export interface AiQuota {
  remainingInBatch: number;
  batchSize: number;
  usedToday: number;
  dailyCap: number;
  lockedUntil: string | null;
  serverNow: string;
}

export interface AiChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiChatResponse {
  reply: string;
  quota: AiQuota | null;
}

export interface ResolvedInvite {
  username: string;
  displayName: string;
  avatarSeed?: string | null;
}

