import type { ApiResult } from '@/types/api';

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  usernameSet: boolean;
}

export interface BlockedUser {
  id: string;
  username: string;
  displayName: string;
}

// Local mock for auth functions not yet in @/lib/apiClient (documented in NEEDS_API.md)
let mockUser: CurrentUser | null = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'current_user',
  displayName: 'Current User',
  usernameSet: true,
};

// Seeded mock blocked users list (see NEEDS_API.md REQ-SETTINGS-01)
const mockBlockedUsers: BlockedUser[] = [
  { id: '33333333-3333-3333-3333-333333333333', username: 'bob', displayName: 'Bob Jones' },
];

export async function signInWithGoogle(): Promise<ApiResult<void>> {
  await new Promise((res) => setTimeout(res, 300));
  return { data: undefined, error: null };
}

export async function signOut(): Promise<ApiResult<void>> {
  await new Promise((res) => setTimeout(res, 200));
  mockUser = null;
  return { data: undefined, error: null };
}

export async function getCurrentUser(): Promise<ApiResult<CurrentUser | null>> {
  await new Promise((res) => setTimeout(res, 100));
  return { data: mockUser, error: null };
}

// TODO: updateDisplayName needs a contract RPC — see NEEDS_API.md (REQ-SETTINGS-02)
export async function updateDisplayName(displayName: string): Promise<ApiResult<void>> {
  await new Promise((res) => setTimeout(res, 200));
  if (!mockUser) {
    return { data: null, error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' } };
  }
  if (displayName.length < 1 || displayName.length > 50) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Display name must be 1-50 characters.' } };
  }
  mockUser = { ...mockUser, displayName };
  return { data: undefined, error: null };
}

// TODO: listBlockedUsers needs a contract RPC — see NEEDS_API.md (REQ-SETTINGS-01)
export async function listBlockedUsers(): Promise<ApiResult<BlockedUser[]>> {
  await new Promise((res) => setTimeout(res, 150));
  return { data: [...mockBlockedUsers], error: null };
}

export function onAuthChange(cb: (user: CurrentUser | null) => void): () => void {
  cb(mockUser);
  return () => {};
}
