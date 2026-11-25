import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, updateAvatarSeed } from '@/lib/apiClient';
import { IdenticonAvatar } from '@/features/chat/components/IdenticonAvatar';
import { AVATAR_PRESETS, getAvatarPreset } from '@/lib/avatarPresets';
import { ArrowLeft, Check, RefreshCw, AlertCircle } from 'lucide-react';

export default function AvatarPage() {

  // ── User state ───────────────────────────────────────────────────
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [avatarSeed, setAvatarSeed] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('default');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string>('');

  // ── Load user ────────────────────────────────────────────────────
  const loadUser = useCallback(async () => {
    setPageState('loading');
    setSaveState('idle');
    setSaveError('');
    try {
      const res = await getCurrentUser();
      if (res.error || !res.data) {
        setPageState('error');
        return;
      }
      setAvatarSeed(res.data.avatarSeed ?? '');
      setUsername(res.data.username);
      setSelectedId(res.data.avatarSeed ? res.data.avatarSeed : 'default');
      setPageState('ready');
    } catch {
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const preset = getAvatarPreset(selectedId);
    const seedToSave = preset.seed ?? username;
    setSaveState('saving');
    setSaveError('');
    try {
      const res = await updateAvatarSeed(seedToSave);
      if (res.error) {
        setSaveState('error');
        setSaveError(res.error.message);
        return;
      }
      setAvatarSeed(seedToSave);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setSaveError('Could not save avatar.');
    }
  };

  // ── Loading state ────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" aria-label="Loading" />
      </main>
    );
  }

  // ── Error state ──────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col items-center text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Could not load your account.</p>
          <button
            type="button"
            onClick={loadUser}
            className="px-4 py-2 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // ── Ready state ──────────────────────────────────────────────────

  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Choose your avatar</h1>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pick an avatar that will appear next to your messages and in your profile.
        </p>

        {/* ── Current avatar preview ─────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Current avatar
          </h2>
          <div className="flex items-center gap-4">
            <IdenticonAvatar
              seed={avatarSeed || username}
              label={username}
              size={64}
            />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seed: {avatarSeed || username}
              </p>
            </div>
          </div>
        </section>

        {/* ── Gallery ────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Avatars
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {AVATAR_PRESETS.map((preset) => {
              const isSelected = selectedId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedId(preset.id)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl min-h-[80px] ${
                    isSelected
                      ? 'ring-2 ring-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                      : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
                  }`}
                >
                  <IdenticonAvatar
                    seed={preset.seed || username}
                    label={username}
                    size={40}
                  />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    {preset.label}
                  </span>
                  {isSelected && (
                    <Check className="w-3 h-3 text-indigo-600" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Save ───────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className={`px-4 py-2 rounded-xl font-medium min-h-[44px] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors ${
              saveState === 'saving'
                ? 'bg-indigo-200 text-indigo-600 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            {saveState === 'saving' && <RefreshCw className="w-3 h-3 animate-spin mr-2" aria-hidden="true" />}
            {saveState === 'saving' ? 'Saving…' : 'Save avatar'}
          </button>
        </div>

        {saveState === 'saved' && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="w-3 h-3" aria-hidden="true" /> Saved
          </p>
        )}
        {saveState === 'error' && (
          <p className="text-xs text-red-500" role="alert">{saveError}</p>
        )}
      </div>
    </main>
  );
}
