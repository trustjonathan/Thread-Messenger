import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { createGroup, searchUserByUsername } from '@/lib/apiClient';
import type { UserProfilePreview } from '@/types/api';

export default function NewGroupPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<UserProfilePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addMember = async () => {
    const username = query.trim().toLowerCase();
    if (!username) return;
    if (members.length >= 19) {
      setError('A group can have at most 20 members.');
      return;
    }
    if (members.some((m) => m.username === username)) {
      setQuery('');
      return;
    }
    const res = await searchUserByUsername(username);
    if (res.error || !res.data) {
      setError('User not found.');
      return;
    }
    setMembers((prev) => [...prev, res.data as UserProfilePreview]);
    setQuery('');
    setError(null);
  };

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await createGroup(
      title.trim(),
      members.map((m) => m.username)
    );
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    navigate(`/chats/${res.data}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Link to="/chats" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-xl font-bold">New group</h1>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Group name"
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        />
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }}
            placeholder="Username"
            className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
          <button type="button" onClick={addMember} className="px-4 rounded-xl bg-indigo-600 text-white min-h-[44px]" aria-label="Add member">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm">
              @{m.username}
              <button type="button" onClick={() => setMembers((prev) => prev.filter((x) => x.id !== m.id))} aria-label={`Remove ${m.username}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || submitting}
          className="w-full p-3 rounded-xl bg-indigo-600 text-white disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Creating...' : `Create group (${members.length + 1}/20)`}
        </button>
      </div>
    </main>
  );
}