import { useState } from 'react';
import { X, Plus, Trash2, LogOut, AlertTriangle } from 'lucide-react';
import { searchUsersByPrefix } from '@/lib/apiClient';
import type { UserProfilePreview } from '@/types/api';
import { useGroupSettings } from '../hooks/useGroupSettings';
import { GroupMemberRow } from './GroupMemberRow';
import { GroupRenameForm } from './GroupRenameForm';
import { IdenticonAvatar } from './IdenticonAvatar';

interface Props {
  conversationId: string;
  title: string;
  description: string | null;
  createdBy: string | null;
  currentUserId: string | null;
  onClose: () => void;
  onLeft: () => void;
}

export function GroupSettingsDrawer({ conversationId, title, description, createdBy, currentUserId, onClose, onLeft }: Props) {
  const isCreator = !!currentUserId && currentUserId === createdBy;
  const { members, loading, error, rename, add, remove, leave, removeGroup, updateDescription } = useGroupSettings(conversationId, true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(description || '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfilePreview[]>([]);
  const [confirm, setConfirm] = useState<{ type: 'remove' | 'leave' | 'delete'; userId?: string; label?: string } | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    const res = await searchUsersByPrefix(q);
    setResults(res.data || []);
  };

  const doConfirm = async () => {
    if (!confirm) return;
    let ok = false;
    if (confirm.type === 'remove' && confirm.userId) ok = await remove(confirm.userId);
    if (confirm.type === 'leave') ok = await leave();
    if (confirm.type === 'delete') ok = await removeGroup();
    setConfirm(null);
    if (ok && (confirm.type === 'leave' || confirm.type === 'delete')) onLeft();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IdenticonAvatar seed={conversationId} label={title} size={40} variant="initials" />
            <div>
              <h2 className="text-base font-semibold truncate">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{members.length} members</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isCreator && !editingTitle && (
          <button type="button" onClick={() => setEditingTitle(true)} className="text-sm text-indigo-600 dark:text-indigo-400 min-h-[44px]">
            Edit group name
          </button>
        )}
        {editingTitle && (
          <GroupRenameForm initialTitle={title} onSave={async (t) => { const ok = await rename(t); if (ok) setEditingTitle(false); return ok; }} onCancel={() => setEditingTitle(false)} />
        )}

        {isCreator && (
          <div className="space-y-2">
            <button type="button" onClick={() => setEditingDesc(!editingDesc)} className="text-sm text-indigo-600 dark:text-indigo-400 min-h-[44px]">
              {editingDesc ? 'Cancel description edit' : 'Edit description'}
            </button>
            {editingDesc && (
              <div className="flex gap-2">
                <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="Description" className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
                <button type="button" onClick={async () => { await updateDescription(desc); setEditingDesc(false); }} className="px-3 rounded-xl bg-indigo-600 text-white min-h-[44px]">Save</button>
              </div>
            )}
          </div>
        )}
        {!isCreator && description && <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>}

        {isCreator && members.length < 20 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={query} onChange={(e) => search(e.target.value)} placeholder="Search username" className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
            </div>
            {results.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((u) => (
                  <button key={u.id} type="button" onClick={async () => { await add([u.username]); setQuery(''); setResults([]); }} className="w-full flex items-center gap-2 p-2 text-left min-h-[44px]">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading && <p className="text-sm text-slate-500 py-2">Loading...</p>}
          {members.map((m) => (
            <GroupMemberRow key={m.userId} member={m} currentUserId={currentUserId} isCreator={isCreator} onRemove={(userId) => setConfirm({ type: 'remove', userId, label: m.username })} />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {confirm && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 space-y-2">
            <p className="text-sm text-red-700 dark:text-red-300">
              {confirm.type === 'remove' ? `Remove @${confirm.label}?` : confirm.type === 'leave' ? 'Leave this group?' : 'Delete group for everyone?'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={doConfirm} className="px-3 rounded-xl bg-red-600 text-white min-h-[44px]">Confirm</button>
              <button type="button" onClick={() => setConfirm(null)} className="px-3 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[44px]">Cancel</button>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          {isCreator ? (
            <button type="button" onClick={() => setConfirm({ type: 'delete' })} className="flex items-center gap-2 text-red-600 dark:text-red-400 min-h-[44px]">
              <Trash2 className="w-4 h-4" /> Delete group
            </button>
          ) : (
            <button type="button" onClick={() => setConfirm({ type: 'leave' })} className="flex items-center gap-2 text-red-600 dark:text-red-400 min-h-[44px]">
              <LogOut className="w-4 h-4" /> Leave group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}