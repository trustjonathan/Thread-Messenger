// TODO: listBlockedUsers and updateDisplayName need contract RPCs — see NEEDS_API.md
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  unblockUser,
  getCurrentUser,
  signOut,
  updateDisplayName,
  listBlockedUsers,
} from '@/lib/apiClient';
import { IdenticonAvatar } from '@/features/chat/components/IdenticonAvatar';
import {
  requestNotificationPermission,
  isNotificationSupported,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from '@/lib/notifications';
import type { BlockedUser } from '@/types/api';
import {
  Copy,
  Check,
  RefreshCw,
  LogOut,
  ChevronRight,
  ShieldOff,
  AlertCircle,
  Bell,
  BellOff,
  ArrowLeft,
} from 'lucide-react';

type PageState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
  const navigate = useNavigate();

  // ── User state ───────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('loading');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() =>
    isNotificationSupported() ? getNotificationsEnabled() : false
  );

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    setNotificationsEnabled(enabled);

    if (enabled && window.Notification.permission !== 'granted') {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        setNotificationsEnabledState(false);
        setNotificationsEnabled(false);
      }
    }
  };

  // ── Blocked users state ──────────────────────────────────────────
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [unblockError, setUnblockError] = useState<string | null>(null);

  // ── Sign out state ───────────────────────────────────────────────
  const [signingOut, setSigningOut] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState('');

  // ── Load user ────────────────────────────────────────────────────
  const loadUser = useCallback(async () => {
    setPageState('loading');
    try {
      const res = await getCurrentUser();
      if (res.error || !res.data) {
        setPageState('error');
        return;
      }
      setUsername(res.data.username);
      setDisplayName(res.data.displayName);
      setDisplayNameDraft(res.data.displayName);
      setAvatarSeed(res.data.avatarSeed ?? '');
      setPageState('ready');
      loadBlocked();
    } catch {
      setPageState('error');
    }
  }, []);

  // ── Load blocked users ───────────────────────────────────────────
  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const res = await listBlockedUsers();
      if (res.data) setBlockedUsers(res.data);
    } catch {
      // silently fail
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may fail in insecure contexts
    }
  };

  const handleSaveDisplayName = async () => {
    const trimmed = displayNameDraft.trim();
    if (trimmed.length < 1 || trimmed.length > 50) return;
    if (trimmed === displayName) return;

    setSaveState('saving');
    setSaveError('');
    try {
      const res = await updateDisplayName(trimmed);
      if (res.error) {
        setSaveState('error');
        setSaveError(res.error.message);
        return;
      }
      setDisplayName(trimmed);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setSaveError('Something went wrong.');
    }
  };

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    setUnblockError(null);
    try {
      const res = await unblockUser(userId);
      if (res.error) {
        setUnblockError(res.error.message);
      } else {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch {
      setUnblockError('Could not unblock user.');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch {
      setSigningOut(false);
    }
  };

  // ── Display name validation ──────────────────────────────────────
  const trimmedDraft = displayNameDraft.trim();
  const nameValid = trimmedDraft.length >= 1 && trimmedDraft.length <= 50;
  const nameChanged = trimmedDraft !== displayName;
  const nameTooLong = displayNameDraft.trim().length > 50;

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
            to="/chats"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight py-4">Settings</h1>
        </div>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Avatar
          </h2>
          <div className="flex items-center gap-4">
            <IdenticonAvatar seed={avatarSeed || username} label={displayName || username} size={48} />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{username}</p>
              <Link
                to="/settings/avatar"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium min-h-[44px] inline-flex items-center"
              >
                Change avatar <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Username ──────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Username
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-slate-900 dark:text-slate-100 select-all">
              @{username}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              aria-label="Copy username"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            {copied && (
              <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
            )}
          </div>
        </section>

        {/* ── Display Name ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Display name
          </h2>
          <div className="space-y-2">
            <input
              type="text"
              value={displayNameDraft}
              onChange={(e) => setDisplayNameDraft(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]"
              aria-label="Display name"
            />
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs ${nameTooLong ? 'text-red-500' : 'text-slate-400'}`}>
                {trimmedDraft.length}/50
              </span>
              {nameChanged && (
                <button
                  type="button"
                  onClick={handleSaveDisplayName}
                  disabled={!nameValid || saveState === 'saving'}
                  className="px-4 py-1.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 flex items-center gap-2"
                >
                  {saveState === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />}
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              )}
              {saveState === 'saved' && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden="true" /> Saved
                </span>
              )}
            </div>
            {nameTooLong && (
              <p className="text-xs text-red-500">Display name must be 1–50 characters.</p>
            )}
            {saveState === 'error' && (
              <p className="text-xs text-red-500" role="alert">{saveError}</p>
            )}
          </div>
        </section>

        {/* ── Notifications ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Notifications
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isNotificationSupported() ? (
                <Bell
                  className={`w-5 h-5 ${notificationsEnabled && window.Notification.permission === 'granted' ? 'text-indigo-600' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
              ) : (
                <BellOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
              )}
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Notifications</span>
            </div>
            <div>
              {!isNotificationSupported() ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notifications not supported in this browser.
                </p>
              ) : notificationsEnabled && window.Notification.permission === 'denied' ? (
                <>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Blocked by browser — enable notifications in browser settings to receive alerts.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleToggleNotifications(true)}
                    className="mt-1 px-3 py-1 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors min-h-[36px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    Re-request permission
                  </button>
                </>
              ) : notificationsEnabled ? (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden="true" /> Enabled
                </span>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">Disabled</span>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => handleToggleNotifications(!notificationsEnabled)}
              className={`relative inline-flex w-11 h-6 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${
                notificationsEnabled
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                  notificationsEnabled
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        {/* ── Blocked Users ─────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Blocked users
          </h2>

          {blockedLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No blocked users.</p>
          ) : (
            <ul className="space-y-2">
              {blockedUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      @{user.username}
                    </span>
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      {user.displayName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(user.id)}
                    disabled={unblockingId === user.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    {unblockingId === user.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldOff className="w-3 h-3" aria-hidden="true" />
                    )}
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unblockError && (
            <p className="mt-2 text-xs text-red-500" role="alert">{unblockError}</p>
          )}
        </section>

        {/* ── Legal Links ───────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          <Link
            to="/privacy"
            className="flex items-center justify-between p-4 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-2xl transition-colors min-h-[44px]"
          >
            Privacy Policy
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </Link>
          <Link
            to="/terms"
            className="flex items-center justify-between p-4 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-b-2xl transition-colors min-h-[44px]"
          >
            Terms of Service
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </Link>
        </section>

        {/* ── Sign Out ──────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl text-sm font-medium border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-60 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          {signingOut ? (
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="w-4 h-4" aria-hidden="true" />
          )}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  );
}
