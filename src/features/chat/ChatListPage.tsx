import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listConversations,
  subscribeToUserMessages,
  getCurrentUser,
  searchMessages,
  OFFLINE_MESSAGE_SYNCED_EVENT,
} from '@/lib/apiClient';
import type { ConversationSummary } from '@/types/api';
import { IdenticonAvatar } from './components/IdenticonAvatar';
import { getHumanErrorMessage } from './components/ErrorMessage';
import { showIncomingMessageNotification } from '@/lib/notifications';
import { Plus, Copy, Check, RefreshCw, MessageSquare, AlertCircle, MoreVertical, Settings, Shield, FileText } from 'lucide-react';

export default function ChatListPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; displayName: string } | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [messageResults, setMessageResults] = useState<Array<{ conversationId: string; messageId: string; body: string; createdAt: string }>>([]);

  useEffect(() => {
    let active = true;
    if (search.trim().length < 2) { setMessageResults([]); return; }
    searchMessages(search.trim()).then((res) => { if (active) setMessageResults(res.data || []); });
    return () => { active = false; };
  }, [search]);

  const fetchConversations = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    setErrorCode(null);
    try {
      const res = await listConversations();
      if (res?.error) {
        setErrorCode(res.error.code);
      } else if (res?.data) {
        setConversations(res.data);
      }
    } catch {
      setErrorCode('OPERATION_FAILED');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const refreshConversations = () => {
      void fetchConversations(true);
    };
    window.addEventListener('online', refreshConversations);
    window.addEventListener(OFFLINE_MESSAGE_SYNCED_EVENT, refreshConversations);
    return () => {
      window.removeEventListener('online', refreshConversations);
      window.removeEventListener(OFFLINE_MESSAGE_SYNCED_EVENT, refreshConversations);
    };
  }, [fetchConversations]);

  // Initial user fetch & conversations load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userRes = await getCurrentUser();
        if (mounted && userRes?.data) {
          setCurrentUser(userRes.data);
          await fetchConversations();
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchConversations]);

  // Subscribe to realtime messages and onResync
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = subscribeToUserMessages(
      currentUser.id,
      (incomingMsg) => {
        // Live update the list on new incoming message
        fetchConversations(true);

        // Desktop notification for incoming message
        if (
          incomingMsg.senderId !== currentUser?.id &&
          document.visibilityState !== 'visible'
        ) {
          const conv = conversations.find((c) => c.conversationId === incomingMsg.conversationId);
          const title =
            conv?.kind === 'group'
              ? conv.title || 'Group'
              : conv?.otherUser?.displayName || conv?.otherUser?.username || 'New message';
          showIncomingMessageNotification({
            conversationId: incomingMsg.conversationId,
            title,
            body: incomingMsg.body,
          });
        }
      },
      () => {
        // onResync fires on (re)connect, tab focus: refetch inside it
        fetchConversations(true);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.id, fetchConversations]);

  const handleCopyUsername = async () => {
    if (!currentUser?.username) return;
    try {
      await navigator.clipboard.writeText(`@${currentUser.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const formatMessageTime = (dateString?: string) => {
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
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-2xl px-4 py-6 flex flex-col flex-1">
        {/* Header */}
        <header className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Chats</span>
            </h1>

            {/* "Your username: @name" with copy button */}
            {currentUser?.username && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span>Your username:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  @{currentUser.username}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUsername}
                  className="p-1 rounded-md text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Copy your username"
                  title="Copy your username"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {copied && (
                  <span className="text-xs text-emerald-600 font-medium">Copied!</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="absolute top-0 right-0 z-10">
              <button type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Menu">
                <MoreVertical className="w-4 h-4" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-20">
                  <Link to="/chats/new-group" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"><Plus className="w-4 h-4" /> New group</Link>
                  <Link to="/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"><Settings className="w-4 h-4" /> Settings</Link>
                  <Link to="/privacy" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"><Shield className="w-4 h-4" /> Privacy</Link>
                  <Link to="/terms" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"><FileText className="w-4 h-4" /> Terms</Link>
                </div>
              )}
            </div>
            {/* Refresh button */}
            <button
              type="button"
              onClick={() => fetchConversations()}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Refresh conversations"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
              />
            </button>

            {/* New chat button to /chats/new */}
            <Link
              to="/chats/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <Plus className="w-4 h-4" />
              <span>New chat</span>
            </Link>
          </div>
        </header>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats and messages" className="mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
        {messageResults.length > 0 && (
          <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {messageResults.slice(0, 10).map((r) => (
              <button key={r.messageId} type="button" onClick={() => navigate(`/chats/${r.conversationId}`)} className="w-full text-left p-3 min-h-[44px]">
                <span className="text-sm line-clamp-2">{r.body}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error notification */}
        {errorCode && (
          <div
            className="my-4 flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{getHumanErrorMessage(errorCode)}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchConversations()}
              className="underline font-medium min-h-[44px] inline-flex items-center"
            >
              Retry
            </button>
          </div>
        )}

        {/* Conversations List */}
        <div className="mt-4 flex-1">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.filter((c) => (c.kind === 'group' ? (c.title || '').toLowerCase().includes(search.toLowerCase()) : (c.otherUser?.displayName || c.otherUser?.username || '').toLowerCase().includes(search.toLowerCase()))).length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No chats yet. Share your username or search for a friend.
              </p>
              <Link
                to="/chats/new"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl min-h-[44px] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Start a conversation</span>
              </Link>
            </div>
          ) : (
            <ul
              className="space-y-2"
              role="list"
              aria-label="Direct conversations"
            >
              {conversations.filter((c) => (c.kind === 'group' ? (c.title || '').toLowerCase().includes(search.toLowerCase()) : (c.otherUser?.displayName || c.otherUser?.username || '').toLowerCase().includes(search.toLowerCase()))).map((conv) => {
                const displayName = conv.kind === 'group' ? (conv.title || 'Group') : (conv.otherUser?.displayName || conv.otherUser?.username || 'Unknown');
                const username = conv.kind === 'group' ? null : conv.otherUser?.username;
                const lastMessage = conv.lastMessage;
                const unreadCount = conv.unreadCount || 0;
                const badgeText = unreadCount >= 100 ? '99+' : unreadCount.toString();

                return (
                  <li key={conv.conversationId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/chats/${conv.conversationId}`)}
                      className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-3 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {conv.kind === 'group' ? (
                        <IdenticonAvatar seed={conv.conversationId} label={displayName} size={40} variant="initials" />
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
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {displayName}
                            {username && (
                              <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                                @{username}
                              </span>
                            )}
                          </span>
                          {lastMessage?.createdAt && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                              {formatMessageTime(lastMessage.createdAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {lastMessage?.body ? lastMessage.body : 'No messages yet'}
                          </p>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-bold text-white bg-indigo-600 rounded-full shrink-0">
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
          )}
        </div>
      </div>
    </div>
  );
}
