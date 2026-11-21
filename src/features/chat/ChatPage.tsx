import { useEffect, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  listConversations,
  loadMessages,
  sendMessage,
  newClientId,
  markRead,
  blockUser,
  reportContent,
  subscribeToUserMessages,
  getCurrentUser,
} from '@/lib/apiClient';
import type { MessageCursor, ConversationSummary, Message } from '@/types/api';
import { Avatar } from './components/Avatar';
import { DateSeparator } from './components/DateSeparator';
import { ReportModal } from './components/ReportModal';
import { BlockModal } from './components/BlockModal';
import { getHumanErrorMessage } from './components/ErrorMessage';
import {
  ArrowLeft,
  MoreVertical,
  Send,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  UserX,
  Info,
} from 'lucide-react';

interface OtherUser {
  id: string;
  username: string;
  displayName: string;
}

interface ChatMessage {
  id?: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'failed';
  errorCode?: string;
}

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<MessageCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [inputBody, setInputBody] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const [composerHeight, setComposerHeight] = useState(64);

  // Measure composer height with ResizeObserver
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const updateHeight = () => {
      setComposerHeight(el.getBoundingClientRect().height);
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateHeight();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  // Auto-grow textarea up to ~6 lines (max ~144px), then scroll inside
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const clampedHeight = Math.min(Math.max(scrollHeight, 44), 144);
    textarea.style.height = `${clampedHeight}px`;
    textarea.style.overflowY = scrollHeight > 144 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputBody, adjustTextareaHeight]);

  // Close header menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Mark read helper
  const triggerMarkRead = useCallback(() => {
    if (!conversationId) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      markRead(conversationId).catch(() => {});
    }
  }, [conversationId]);

  // Visibility change listener for markRead
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerMarkRead();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerMarkRead]);

  // Load conversation metadata (other user)
  const loadConversationMeta = useCallback(async () => {
    if (!conversationId) return;
    try {
      const convsRes = await listConversations();
      if (convsRes?.data) {
        const currentConv = convsRes.data.find(
          (c: ConversationSummary) => c.conversationId === conversationId
        );
        if (currentConv?.otherUser) {
          setOtherUser(currentConv.otherUser);
        }
      }
    } catch {
      // Handled gracefully
    }
  }, [conversationId]);

  // Load initial messages (API returns newest first; reverse for bottom-newest display)
  const fetchInitialMessages = useCallback(async () => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    setPageError(null);

    try {
      const res = await loadMessages({ conversationId, limit: 30 });
      if (res?.error) {
        setPageError(res.error.code);
      } else if (res?.data) {
        const rawList = res.data.messages || [];
        const formatted: ChatMessage[] = rawList
          .slice()
          .reverse()
          .map((m: Message) => ({
            id: m.id,
            clientId: m.clientId || m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt,
            status: 'sent',
          }));
        setMessages(formatted);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.hasMore);
        triggerMarkRead();
      }
    } catch {
      setPageError('OPERATION_FAILED');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [conversationId, triggerMarkRead]);

  // Initial user, conversation, and messages fetch
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userRes = await getCurrentUser();
        if (mounted && userRes?.data) {
          setCurrentUserId(userRes.data.id);
          await loadConversationMeta();
          await fetchInitialMessages();
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadConversationMeta, fetchInitialMessages]);

  // Scroll to bottom on initial load or new sent/received messages
  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!isLoadingMessages && !isLoadingEarlier) {
      scrollToBottom();
    }
  }, [messages.length, isLoadingMessages, isLoadingEarlier, scrollToBottom]);

  // Load earlier messages (pagination)
  const handleLoadEarlier = async () => {
    if (!conversationId || !nextCursor || isLoadingEarlier) return;
    setIsLoadingEarlier(true);

    try {
      const scrollContainer = messageListContainerRef.current;
      const prevScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

      const res = await loadMessages({ conversationId, cursor: nextCursor, limit: 30 });
      if (res?.data) {
        const rawList = res.data.messages || [];
        const olderFormatted: ChatMessage[] = rawList
          .slice()
          .reverse()
          .map((m: Message) => ({
            id: m.id,
            clientId: m.clientId || m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt,
            status: 'sent',
          }));

        setMessages((prev) => {
          // De-duplicate prepended older messages
          const existingIds = new Set(prev.map((m) => m.id || m.clientId));
          const filteredOlder = olderFormatted.filter((m) => !existingIds.has(m.id || m.clientId));
          return [...filteredOlder, ...prev];
        });
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.hasMore);

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  // Realtime subscription and onResync
  useEffect(() => {
    if (!currentUserId || !conversationId) return;

    const unsubscribe = subscribeToUserMessages(
      currentUserId,
      (incomingMsg: Message) => {
        if (incomingMsg.conversationId !== conversationId) return;

        // De-duplicate incoming realtime messages against the list by id AND clientId
        setMessages((prev) => {
          const index = prev.findIndex(
            (m) =>
              (incomingMsg.id && m.id === incomingMsg.id) ||
              (incomingMsg.clientId && m.clientId === incomingMsg.clientId)
          );

          if (index !== -1) {
            // Update existing message
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              id: incomingMsg.id,
              clientId: incomingMsg.clientId || updated[index].clientId,
              body: incomingMsg.body,
              createdAt: incomingMsg.createdAt,
              status: 'sent',
            };
            return updated;
          }

          // Append new incoming message
          const newMsg: ChatMessage = {
            id: incomingMsg.id,
            clientId: incomingMsg.clientId || incomingMsg.id,
            conversationId: incomingMsg.conversationId,
            senderId: incomingMsg.senderId,
            body: incomingMsg.body,
            createdAt: incomingMsg.createdAt,
            status: 'sent',
          };
          return [...prev, newMsg];
        });

        // Call markRead when new incoming message arrives while visible
        triggerMarkRead();
      },
      () => {
        // onResync fires on (re)connect, tab focus: refetch newest messages
        fetchInitialMessages();
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUserId, conversationId, triggerMarkRead, fetchInitialMessages]);

  // Send message with OPTIMISTIC SEND
  const handleSend = async (messageToSend?: ChatMessage) => {
    if (!conversationId) return;

    let targetClientId: string;
    let targetBody: string;

    if (messageToSend) {
      // Retry with the SAME clientId
      targetClientId = messageToSend.clientId;
      targetBody = messageToSend.body;

      // Update message status to sending
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === targetClientId ? { ...m, status: 'sending', errorCode: undefined } : m
        )
      );
    } else {
      const trimmed = inputBody.trim();
      if (!trimmed || trimmed.length > 2000) return;

      targetClientId = newClientId();
      targetBody = trimmed;
      setInputBody('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });

      const optimisticMsg: ChatMessage = {
        clientId: targetClientId,
        conversationId,
        senderId: currentUserId || 'me',
        body: targetBody,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);
    }

    try {
      const res = await sendMessage({
        conversationId,
        body: targetBody,
        clientId: targetClientId,
      });

      if (res?.error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === targetClientId
              ? { ...m, status: 'failed', errorCode: res.error.code }
              : m
          )
        );
      } else if (res?.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === targetClientId
              ? {
                  ...m,
                  id: res.data.id,
                  status: 'sent',
                  createdAt: res.data.createdAt,
                  errorCode: undefined,
                }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === targetClientId
            ? { ...m, status: 'failed', errorCode: 'OPERATION_FAILED' }
            : m
        )
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Do NOT send while IME composition is active
    if (e.nativeEvent.isComposing || (e as unknown as { isComposing?: boolean }).isComposing) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReportSubmit = async (reason: string) => {
    if (!otherUser?.id) return;
    const res = await reportContent({
      userId: otherUser.id,
      reason,
    });
    if (res?.error) {
      throw new Error(getHumanErrorMessage(res.error.code));
    }
  };

  const handleBlockConfirm = async () => {
    if (!otherUser?.id) return;
    const res = await blockUser(otherUser.id);
    if (res?.error) {
      throw new Error(getHumanErrorMessage(res.error.code));
    }
    navigate('/chats');
  };

  const otherDisplayName = otherUser?.displayName || otherUser?.username || 'Chat';
  const otherUsername = otherUser?.username;
  const charCount = inputBody.length;
  const isSendDisabled = inputBody.trim().length === 0 || charCount > 2000;

  return (
    <div className="flex flex-col h-[100dvh] w-full relative bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/chats"
            className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <Avatar name={otherDisplayName} size="sm" />

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {otherDisplayName}
            </h1>
            {otherUsername && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                @{otherUsername}
              </p>
            )}
          </div>
        </div>

        {/* Options Menu (Report, Block) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Conversation actions"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-20 focus:outline-none"
              role="menu"
            >
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsReportOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] text-left"
                role="menuitem"
              >
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Report</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsBlockOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[44px] text-left"
                role="menuitem"
              >
                <UserX className="w-4 h-4" />
                <span>Block User</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Message List */}
      <div
        ref={messageListContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ paddingBottom: `${composerHeight + 24}px` }}
        role="region"
        aria-label="Message history"
        aria-live="polite"
      >
        {/* Load Earlier button */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={handleLoadEarlier}
              disabled={isLoadingEarlier}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isLoadingEarlier ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading earlier messages...</span>
                </>
              ) : (
                <span>Load earlier</span>
              )}
            </button>
          </div>
        )}

        {/* Global Page Error */}
        {pageError && (
          <div
            className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 flex items-center justify-between"
            role="alert"
          >
            <span>{getHumanErrorMessage(pageError)}</span>
            <button
              type="button"
              onClick={fetchInitialMessages}
              className="underline font-medium min-h-[44px] inline-flex items-center"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty Chat Note */}
        {!isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No messages yet in this conversation.
            </p>
            {/* Required note in empty chat */}
            <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5" />
              <span>Messages are not end-to-end encrypted.</span>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoadingMessages && messages.length === 0 && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`h-10 rounded-2xl animate-pulse ${
                    i % 2 === 0 ? 'bg-slate-200 dark:bg-slate-800 w-48' : 'bg-indigo-200 dark:bg-indigo-900/40 w-40'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Messages with Date Separators */}
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUserId;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator =
            !prevMsg ||
            new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          const formatTime = (isoString: string) => {
            try {
              return new Date(isoString).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch {
              return '';
            }
          };

          return (
            <div key={msg.id || msg.clientId}>
              {showDateSeparator && <DateSeparator date={msg.createdAt} />}

              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                    isOwn
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-sm'
                  }`}
                >
                  {/* Rendered as plain text: React escaping only */}
                  {msg.body}
                </div>

                {/* Status and Timestamp */}
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{formatTime(msg.createdAt)}</span>

                  {isOwn && (
                    <>
                      {msg.status === 'sending' && (
                        <span className="text-slate-400">· sending...</span>
                      )}
                      {msg.status === 'sent' && (
                        <span className="text-slate-400">· sent</span>
                      )}
                      {msg.status === 'failed' && (
                        <div className="flex items-center gap-1 text-red-500">
                          <AlertCircle className="w-3 h-3" />
                          <button
                            type="button"
                            onClick={() => handleSend(msg)}
                            className="underline font-medium hover:text-red-700 dark:hover:text-red-400 min-h-[44px] inline-flex items-center"
                          >
                            Failed - Retry
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Composer */}
      <footer
        ref={composerRef}
        className="fixed inset-x-0 z-20 px-3 flex justify-center pointer-events-none"
        style={{
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="pointer-events-auto w-full max-w-[672px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-lg p-2 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-shadow"
        >
          <div className="flex items-end gap-2 w-full">
            <label htmlFor="composer-message-input" className="sr-only">
              Message
            </label>
            <textarea
              id="composer-message-input"
              ref={textareaRef}
              rows={1}
              value={inputBody}
              onChange={(e) => setInputBody(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              placeholder="Message"
              aria-label="Message"
              className="flex-1 min-h-[44px] max-h-[144px] py-2.5 px-3 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none leading-relaxed"
            />

            <button
              type="submit"
              disabled={isSendDisabled}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px] min-w-[44px] ${
                isSendDisabled
                  ? 'bg-indigo-300 dark:bg-indigo-950/60 text-white/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm'
              }`}
              aria-label="Send message"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>

          {/* 2000-char counter: hidden unless draft is 1800+ chars, turns red at 2000 */}
          {charCount >= 1800 && (
            <div className="flex justify-end px-3 pt-1 pb-0.5 text-[11px]">
              <span
                className={
                  charCount >= 2000
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {charCount}/2000
              </span>
            </div>
          )}
        </form>
      </footer>

      {/* Modals */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onSubmit={handleReportSubmit}
        targetName={`@${otherDisplayName}`}
      />

      <BlockModal
        isOpen={isBlockOpen}
        onClose={() => setIsBlockOpen(false)}
        onConfirm={handleBlockConfirm}
        username={otherUsername || otherDisplayName}
      />
    </div>
  );
}
