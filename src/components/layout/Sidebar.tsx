import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Copy,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  FileText,
  MessageSquarePlus,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { InviteFriendsModal } from '@/features/chat/components/InviteFriendsModal';
import { markRead } from '@/lib/apiClient';
import type { ConversationSummary, CurrentUser } from '@/types/api';
import { IdenticonAvatar } from '@/features/chat/components/IdenticonAvatar';
import { getHumanErrorMessage } from '@/features/chat/components/ErrorMessage';
import { APP_NAME } from '@/lib/constants';
import { AiChat } from '@/components/layout/AiChat';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type Filter = 'All' | 'Unread' | 'Groups';
const FILTERS: Filter[] = ['All', 'Unread', 'Groups'];

interface Props {
  chats: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  currentUser: CurrentUser | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  errorCode: string | null;
  onRetry: () => void;
}

export function Sidebar({
  chats,
  activeId,
  onSelect,
  currentUser,
  isRefreshing,
  onRefresh,
  errorCode,
  onRetry,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAISheetOpen, setIsAISheetOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * md breakpoint = 768px.
   * On md+ we use the desktop layout: AI opens in the right pane (/ai route).
   * Below md we use the mobile layout: AI opens as a slide-up sheet.
   */
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      if (filter === 'Unread' && (c.unreadCount || 0) === 0) return false;
      if (filter === 'Groups' && c.kind !== 'group') return false;
      if (!q) return true;
      return (
        c.kind === 'group'
          ? (c.title || '').toLowerCase().includes(q)
          : (c.otherUser?.displayName || c.otherUser?.username || '')
              .toLowerCase()
              .includes(q)
      );
    });
  }, [chats, query, filter]);

  const formatMessageTime = useCallback((dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, []);

  const handleCopyUsername = async () => {
    if (!currentUser?.username) return;
    try {
      await navigator.clipboard.writeText(`@${currentUser.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may fail in insecure contexts
    }
  };

  // ── Menu: close on outside click, Escape, route change, scroll ──────────────
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const handleScroll = () => setIsMenuOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // ── Keyboard open detection (mobile only) ───────────────────────────────────
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (isDesktop || typeof window.visualViewport === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [isDesktop]);

  const hideFloatingButtons = isSearchFocused || keyboardOpen;

  // ── AI button handler ───────────────────────────────────────────────────────
  const handleAiClick = () => {
    if (isDesktop) {
      navigate('/ai');
    } else {
      setIsAISheetOpen(true);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-thread-text dark:text-thread-text flex items-center gap-2 shrink-0">
            <span className="text-thread-accent">{APP_NAME}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* ── ⋮ Menu button — wrapped in relative so the dropdown anchors to it ── */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((p) => !p)}
              className="p-2.5 rounded-xl text-thread-muted dark:text-thread-muted hover:bg-thread-soft dark:hover:bg-thread-soft transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-thread-accent"
              aria-label="Menu"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-thread-border dark:border-thread-border shadow-lg py-1.5 z-50"
                role="menu"
                aria-label="Sidebar menu"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInviteOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text hover:bg-thread-soft min-h-[44px] w-full text-left"
                  role="menuitem"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Invite friends</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleCopyUsername();
                  }}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text dark:text-thread-text hover:bg-thread-soft dark:hover:bg-thread-soft min-h-[44px] w-full text-left ${copied ? 'text-green-600 dark:text-green-400' : ''}`}
                  role="menuitem"
                >
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Copy my username</span>
                  {copied && <span className="ml-auto text-xs text-green-600 dark:text-green-400">Copied</span>}
                </button>
                <Link
                  to="/chats/new-group"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text dark:text-thread-text hover:bg-thread-soft dark:hover:bg-thread-soft min-h-[44px]"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Plus className="w-4 h-4" /> New group
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text dark:text-thread-text hover:bg-thread-soft dark:hover:bg-thread-soft min-h-[44px]"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <Link
                  to="/privacy"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text dark:text-thread-text hover:bg-thread-soft dark:hover:bg-thread-soft min-h-[44px]"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Shield className="w-4 h-4" /> Privacy
                </Link>
                <Link
                  to="/terms"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-thread-text dark:text-thread-text hover:bg-thread-soft dark:hover:bg-thread-soft min-h-[44px]"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FileText className="w-4 h-4" /> Terms
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl text-thread-muted dark:text-thread-muted hover:bg-thread-soft dark:hover:bg-thread-soft transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-thread-accent"
            aria-label="Refresh conversations"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-thread-accent' : ''}`}
            />
          </button>
        </div>
      </header>

      <div className="px-3 py-2">
        <label
          className="flex items-center gap-3 rounded-full bg-thread-bg px-4 py-2 focus-within:ring-2 focus-within:ring-thread-accent"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search chats and messages"
            className="w-full bg-transparent text-sm outline-none placeholder:text-thread-muted min-h-[44px]"
          />
        </label>
      </div>

      <div className="flex gap-2 px-3 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === f
                ? 'border-thread-accent bg-thread-soft text-thread-accent'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ul
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label="Direct conversations"
        style={{ paddingBottom: 96 }}
      >
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-thread-muted">
            No chats found
          </li>
        )}
        {visible.map((conv) => {
          const displayName =
            conv.kind === 'group'
              ? conv.title || 'Group'
              : conv.otherUser?.displayName || conv.otherUser?.username || 'Unknown';
          const username = conv.kind === 'group' ? null : conv.otherUser?.username;
          const lastMessage = conv.lastMessage;
          const unreadCount = conv.unreadCount || 0;
          const badgeText = unreadCount >= 100 ? '99+' : unreadCount.toString();

          return (
            <li key={conv.conversationId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(conv.conversationId);
                  markRead(conv.conversationId).catch(() => {});
                }}
                className={`w-full p-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-3 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-thread-accent ${
                  activeId === conv.conversationId
                    ? 'bg-thread-soft border-thread-accent'
                    : ''
                }`}
              >
                {conv.kind === 'group' ? (
                  <IdenticonAvatar
                    seed={conv.conversationId}
                    label={displayName}
                    size={40}
                    variant="initials"
                  />
                ) : (
                  <IdenticonAvatar
                    seed={conv.otherUser?.avatarSeed ?? conv.otherUser?.username ?? ''}
                    label={username || displayName}
                    size={40}
                    userId={conv.otherUser?.id ?? undefined}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-thread-text dark:text-thread-text truncate">
                      {displayName}
                      {username && (
                        <span className="ml-1.5 text-xs font-normal text-thread-muted dark:text-thread-muted">
                          @{username}
                        </span>
                      )}
                    </span>
                    {lastMessage?.createdAt && (
                      <span className="text-xs text-thread-muted dark:text-thread-muted shrink-0">
                        {formatMessageTime(lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-thread-muted dark:text-thread-muted truncate">
                      {lastMessage?.body ? lastMessage.body : 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold text-white bg-thread-accent rounded-full shrink-0">
                        {badgeText}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {errorCode && (
        <div
          className="my-4 flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{getHumanErrorMessage(errorCode)}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="underline font-medium min-h-[44px] inline-flex items-center"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Mobile FABs: New chat LEFT, AI RIGHT ─────────────────────────── */}
      {!isDesktop && !hideFloatingButtons && (
        <>
          <button
            type="button"
            onClick={() => navigate('/chats/new')}
            className="fixed z-40 left-16 bottom-[calc(16px+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-thread-accent text-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-slate-900 hover:bg-indigo-700 prefers-reduced-motion:transition-none"
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </button>
          <Link
            to="/t-chat"
            className="fixed z-40 left-1/2 bottom-[calc(20px+env(safe-area-inset-bottom))] -translate-x-1/2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-thread-accent shadow-lg ring-1 ring-thread-border transition-colors hover:bg-thread-soft focus:outline-none focus:ring-2 focus:ring-thread-accent dark:bg-slate-900 dark:text-thread-accent dark:ring-slate-700"
            aria-label="T-Chat"
            title="T-Chat"
          >
            T-Chat
          </Link>
          <button
            type="button"
            onClick={handleAiClick}
            className="fixed z-40 right-16 bottom-[calc(16px+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-thread-accent text-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-slate-900 hover:bg-indigo-700 prefers-reduced-motion:transition-none"
            aria-label="Ask AI"
            title="Ask AI"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </>
      )}

      {/* ── Desktop buttons (bottom of chat-list column): New chat LEFT, AI RIGHT ── */}
      {isDesktop && (
        <div className="flex justify-between px-4 py-4">
          {/* New chat – left */}
          <button
            type="button"
            onClick={() => navigate('/chats/new')}
            className="w-14 h-14 rounded-full bg-thread-accent text-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-slate-900 hover:bg-indigo-700 prefers-reduced-motion:transition-none"
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </button>
          <Link
            to="/t-chat"
            className="inline-flex min-h-11 items-center rounded-full border border-thread-border bg-white px-5 text-sm font-semibold text-thread-accent shadow-sm transition-colors hover:bg-thread-soft focus:outline-none focus:ring-2 focus:ring-thread-accent dark:border-slate-700 dark:bg-slate-900 dark:text-thread-accent"
            aria-label="T-Chat"
            title="T-Chat"
          >
            T-Chat
          </Link>
          {/* AI – right */}
          <button
            type="button"
            onClick={handleAiClick}
            className="w-14 h-14 rounded-full bg-thread-accent text-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-slate-900 hover:bg-indigo-700 prefers-reduced-motion:transition-none"
            aria-label="Ask AI"
            title="Ask AI"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      )}

      <InviteFriendsModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />

      {/* Mobile AI sheet (only shown on mobile) */}
      {isAISheetOpen && !isDesktop && (
        <AiChat variant="sheet" onClose={() => setIsAISheetOpen(false)} />
      )}
    </>
  );
}
