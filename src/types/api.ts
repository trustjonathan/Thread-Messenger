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
  | 'UNKNOWN_ERROR';

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
}

export interface ConversationSummary {
  conversationId: string;
  createdAt: string;
  otherUser: UserProfilePreview;
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

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: MessageCursor | null;
  hasMore: boolean;
}
