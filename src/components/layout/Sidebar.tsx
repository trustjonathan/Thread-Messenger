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
import { useIsDesktop } from '@/hooks/useMediaQuery';

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
   * The desktop layout starts at the shared `lg` breakpoint (1024px).
   * On lg+ AI opens in the right pane (/ai route); below it, AI opens as a
   * slide-up sheet. ChatLayout uses the same breakpoint for its two-column view.
   */
  const isDesktop = useIsDesktop();

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
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <span
            aria-hidden="true"
            className="thread-gradient-bg thread-animate-pop flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-thread-glow"
          >
            {APP_NAME.charAt(0)}
          </span>
          <h1 className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight text-thread-text">
            <span className="thread-gradient-text">{APP_NAME}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* ── ⋮ Menu button — wrapped in relative so the dropdown anchors to it ── */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((p) => !p)}
              className="thread-focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-thread-muted transition-all hover:scale-105 hover:bg-thread-soft hover:text-thread-accent-2 focus:ring-2 focus:ring-thread-accent"
              aria-label="Menu"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="thread-glass thread-animate-pop absolute right-0 top-full z-50 mt-1 w-48 rounded-2xl py-1.5"
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
            className="thread-focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-thread-muted transition-all hover:scale-105 hover:bg-thread-soft hover:text-thread-accent-2 focus:ring-2 focus:ring-thread-accent disabled:opacity-60"
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
          className="flex items-center gap-3 rounded-full border border-thread-border bg-thread-surface-2 px-4 py-1.5 transition-colors focus-within:border-thread-accent-2 focus-within:bg-thread-surface focus-within:ring-2 focus-within:ring-thread-accent-tint"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search chats and messages"
            aria-label="Search chats and messages"
            className="min-h-[44px] w-full bg-transparent text-sm text-thread-text outline-none placeholder:text-thread-muted"
          />
        </label>
      </div>

      <div className="flex gap-2 px-3 pb-3" role="group" aria-label="Conversation filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`thread-chip thread-focus-ring min-h-[36px] px-3.5 py-1 text-xs font-medium ${
              filter === f ? 'thread-chip--active' : ''
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ul
        className="thread-scrollbar flex-1 space-y-1.5 overflow-y-auto px-2"
        role="list"
        aria-label="Direct conversations"
        style={{ paddingBottom: 96 }}
      >
        {visible.length === 0 && (
          <li className="thread-animate-in px-4 py-10 text-center">
            <p className="text-sm font-medium text-thread-text">No chats found</p>
            <p className="mt-1 text-xs text-thread-muted">Try another search or filter.</p>
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
                aria-current={activeId === conv.conversationId ? 'true' : undefined}
                className={`thread-card thread-focus-ring thread-animate-in relative flex w-full items-center gap-3 overflow-hidden p-3.5 text-left transition-all hover:-translate-y-px hover:border-thread-accent-2 min-h-[44px] ${
                  activeId === conv.conversationId ? 'thread-conversation-active' : ''
                }`}
              >
                {activeId === conv.conversationId && (
                  <span
                    aria-hidden="true"
                    className="thread-gradient-bg absolute inset-y-2 left-0 w-1 rounded-r-full"
                  />
                )}
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
                      <span className="shrink-0 text-[11px] font-medium text-thread-muted">
                        {formatMessageTime(lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs leading-snug text-thread-muted">
                      {lastMessage?.body ? lastMessage.body : 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                      <span
                        className={`thread-gradient-bg thread-animate-pop inline-flex min-w-[22px] shrink-0 items-center justify-center rounded-full px-2 py-0.5 font-bold leading-tight shadow-thread-glow ${
                          unreadCount >= 10 ? 'text-[10px]' : 'text-xs'
                        }`}
                      >
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
          className="thread-animate-in mx-2 my-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
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
            className="thread-fab thread-focus-ring fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-16 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-thread-accent text-white focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-thread-bg"
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </button>
          <Link
            to="/t-chat"
            className="thread-chip thread-focus-ring fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-thread-accent-2 shadow-thread hover:-translate-y-0.5 hover:text-thread-accent-2 focus:ring-2 focus:ring-thread-accent"
            aria-label="T-Chat"
            title="T-Chat"
          >
            T-Chat
          </Link>
          <button
            type="button"
            onClick={handleAiClick}
            className="thread-fab thread-focus-ring fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-16 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-thread-accent text-white focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-thread-bg"
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
            className="thread-fab thread-focus-ring flex h-14 w-14 items-center justify-center rounded-full bg-thread-accent text-white focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-thread-bg"
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </button>
          <Link
            to="/t-chat"
            className="thread-chip thread-focus-ring inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-thread-accent-2 shadow-thread focus:ring-2 focus:ring-thread-accent"
            aria-label="T-Chat"
            title="T-Chat"
          >
            T-Chat
          </Link>
          {/* AI – right */}
          <button
            type="button"
            onClick={handleAiClick}
            className="thread-fab thread-focus-ring flex h-14 w-14 items-center justify-center rounded-full bg-thread-accent text-white focus:ring-2 focus:ring-thread-accent focus:ring-offset-2 dark:focus:ring-offset-thread-bg"
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
