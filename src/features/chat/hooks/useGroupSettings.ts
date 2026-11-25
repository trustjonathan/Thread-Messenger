import { useCallback, useEffect, useState } from 'react';
import {
  listGroupMembers,
  renameGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  updateGroupDescription,
} from '@/lib/apiClient';
import type { GroupMember } from '@/types/api';

export function useGroupSettings(conversationId: string | undefined, enabled: boolean) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const res = await listGroupMembers(conversationId);
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setMembers(res.data || []);
    setError(null);
  }, [conversationId]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const rename = async (title: string) => {
    if (!conversationId) return false;
    const res = await renameGroup(conversationId, title);
    if (res.error) setError(res.error.message);
    else setError(null);
    return !res.error;
  };

  const add = async (usernames: string[]) => {
    if (!conversationId) return false;
    const res = await addGroupMembers(conversationId, usernames);
    if (res.error) { setError(res.error.message); return false; }
    const results = res.data || [];
    const hasFull = results.some((r) => r.status === 'group_full');
    const hasNotAllowed = results.some((r) => r.status === 'not_allowed');
    if (hasFull) { setError('This group is full (max 20 members).'); return false; }
    if (hasNotAllowed) { setError('Only the group creator can add members.'); return false; }
    const anyAdded = results.some((r) => r.status === 'added');
    if (anyAdded) { setError(null); await refresh(); }
    return true;
  };

  const remove = async (userId: string) => {
    if (!conversationId) return false;
    const res = await removeGroupMember(conversationId, userId);
    if (res.error) setError(res.error.message);
    else { setError(null); await refresh(); }
    return !res.error;
  };

  const leave = async () => {
    if (!conversationId) return false;
    const res = await leaveGroup(conversationId);
    if (res.error) setError(res.error.message);
    return !res.error;
  };

  const removeGroup = async () => {
    if (!conversationId) return false;
    const res = await deleteGroup(conversationId);
    if (res.error) setError(res.error.message);
    return !res.error;
  };

  const updateDescription = async (description: string) => {
    if (!conversationId) return false;
    const res = await updateGroupDescription(conversationId, description);
    if (res.error) setError(res.error.message);
    return !res.error;
  };

  return { members, loading, error, refresh, rename, add, remove, leave, removeGroup, updateDescription };
}