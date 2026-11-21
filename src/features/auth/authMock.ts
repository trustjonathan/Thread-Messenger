import type { ApiResult } from '@/types/api';

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  usernameSet: boolean;
}

// Local mock for auth functions not yet in @/lib/apiClient (documented in NEEDS_API.md)
let mockUser: CurrentUser | null = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'current_user',
  displayName: 'Current User',
  usernameSet: true,
};

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

export function onAuthChange(cb: (user: CurrentUser | null) => void): () => void {
  cb(mockUser);
  return () => {};
}
