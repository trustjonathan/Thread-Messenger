import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  listConversations,
  loadMessages,
  sendMessage,
  newClientId,
  markRead,
  setTyping,
  subscribeToUserMessages,
  getCurrentUser,
  listGroupMembers,
  blockUser,
  reportContent,
} from '@/lib/apiClient';
import type {
  ConversationSummary,
  Message,
  GroupMember,
  MessageCursor,
} from '@/types/api';
import { Avatar } from '@/features/chat/components/Avatar';
import { IdenticonAvatar } from '@/features/chat/components/IdenticonAvatar';
import { GroupHeader } from '@/features/chat/components/GroupHeader';
import { GroupSettingsDrawer } from '@/features/chat/components/GroupSettingsDrawer';
import { MessageStatus } from '@/components/chat/MessageStatus';
import { DateSeparator } from '@/features/chat/components/DateSeparator';
import { ReportModal } from '@/features/chat/components/ReportModal';
import { BlockModal } from '@/features/chat/components/BlockModal';
import { getHumanErrorMessage } from '@/features/chat/components/ErrorMessage';
import { showIncomingMessageNotification } from '@/lib/notifications';
import {
  ArrowLeft,
  MoreVertical,
  Send,
  RefreshCw,
  ShieldAlert,
  UserX,
  Info,
  Paperclip,
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

interface Props {
  chatId: string;
  onBack: () => void;
  onMessageSent: (conversationId: string, lastMessage: { body: string; createdAt: string }) => void;
}

export function ChatPane({ chatId, onBack, onMessageSent }: Props) {
  const ts = () => new Date().toISOString().split('T')[1].split('.')[0];
  const navigate = useNavigate();
  const location = useLocation();

  console.log(`[${ts()}] [ChatPane] mount chatId=${chatId}`);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [groupTitle, setGroupTitle] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [groupDescription, setGroupDescription] = useState<string | null>(null);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
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
  const lastTypingRef = useRef(0);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const handleScroll = () => setIsMenuOpen(false);
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const triggerMarkRead = useCallback(() => {
    if (!chatId) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      markRead(chatId).catch(() => {});
    }
  }, [chatId]);

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

  const loadConversationMeta = useCallback(async () => {
    if (!chatId) return;
    try {
      const convsRes = await listConversations();
      if (convsRes?.data) {
        const currentConv = convsRes.data.find(
          (c: ConversationSummary) => c.conversationId === chatId
        );
        if (currentConv?.otherUser) {
          setOtherUser(currentConv.otherUser);
        }
        if (currentConv?.kind === 'group') {
          setGroupTitle(currentConv.title || 'Group');
          setMemberCount(currentConv.memberCount || 0);
          setGroupCreatedBy(currentConv.createdBy || null);
          setGroupDescription(currentConv.description || null);
        }
      }
    } catch {
      // Handled gracefully
    }
  }, [chatId]);

  useEffect(() => {
    let active = true;
    if (!chatId || !groupTitle) return;
    listGroupMembers(chatId).then((res) => {
      if (active) setGroupMembers(res.data || []);
    });
    return () => {
      active = false;
    };
  }, [chatId, groupTitle]);

  const fetchInitialMessages = useCallback(async () => {
    if (!chatId) return;
    setIsLoadingMessages(true);
    setPageError(null);

    try {
      const res = await loadMessages({ conversationId: chatId, limit: 30 });
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
  }, [chatId, triggerMarkRead]);

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

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!isLoadingMessages && !isLoadingEarlier) {
      scrollToBottom();
    }
  }, [messages.length, isLoadingMessages, isLoadingEarlier, scrollToBottom]);

  const handleLoadEarlier = async () => {
    if (!chatId || !nextCursor || isLoadingEarlier) return;
    setIsLoadingEarlier(true);

    try {
      const scrollContainer = messageListContainerRef.current;
      const prevScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

      const res = await loadMessages({ conversationId: chatId, cursor: nextCursor, limit: 30 });
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
          const existingIds = new Set(prev.map((m) => m.id || m.clientId));
          const filteredOlder = olderFormatted.filter(
            (m) => !existingIds.has(m.id || m.clientId)
          );
          return [...filteredOlder, ...prev];
        });
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.hasMore);

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

  useEffect(() => {
    if (!currentUserId || !chatId) return;

    const unsubscribe = subscribeToUserMessages(
      currentUserId,
      (incomingMsg: Message) => {
        if (
          currentUserId &&
          incomingMsg.senderId !== currentUserId &&
          (document.visibilityState !== 'visible' ||
            incomingMsg.conversationId !== chatId)
        ) {
          const sender = groupMembers.find((m) => m.userId === incomingMsg.senderId);
          const senderName = sender
            ? sender.displayName || sender.username
            : otherUser?.displayName || otherUser?.username || 'Someone';
          const convoTitle = groupTitle || otherUser?.displayName || otherUser?.username || 'Chat';
          const title =
            incomingMsg.conversationId === chatId && groupTitle
              ? `${senderName} in ${convoTitle}`
              : incomingMsg.conversationId !== chatId
              ? 'New message'
              : `${senderName}:`;
          showIncomingMessageNotification({
            conversationId: incomingMsg.conversationId,
            title,
            body: incomingMsg.body,
          });
        }

        if (incomingMsg.conversationId !== chatId) return;

        setMessages((prev) => {
          const index = prev.findIndex(
            (m) =>
              (incomingMsg.id && m.id === incomingMsg.id) ||
              (incomingMsg.clientId && m.clientId === incomingMsg.clientId)
          );

          if (index !== -1) {
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

        triggerMarkRead();
      },
      () => {
        fetchInitialMessages();
      }
    );

    return () => {
      console.log(`[${ts()}] [ChatPane] unmount chatId=${chatId} unsubscribing realtime`);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUserId, chatId, triggerMarkRead, fetchInitialMessages, groupMembers, otherUser, groupTitle]);

  const handleSend = async (messageToSend?: ChatMessage) => {
    if (!chatId) return;

    let targetClientId: string;
    let targetBody: string;

    if (messageToSend) {
      targetClientId = messageToSend.clientId;
      targetBody = messageToSend.body;

      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === targetClientId
            ? { ...m, status: 'sending', errorCode: undefined }
            : m
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
        conversationId: chatId,
        senderId: currentUserId || 'me',
        body: targetBody,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);
    }

    try {
      const res = await sendMessage({
        conversationId: chatId,
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
        onMessageSent(chatId, {
          body: targetBody,
          createdAt: res.data.createdAt,
        });
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

  const otherDisplayName =
    groupTitle || otherUser?.displayName || otherUser?.username || 'Chat';
  const otherUsername = otherUser?.username;
  const charCount = inputBody.length;
  const isSendDisabled = inputBody.trim().length === 0 || charCount > 2000;

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
    <div className="flex flex-col h-full w-full relative bg-thread-bg text-thread-text">
      {/* Header */}
      <header className="shrink-0 h-[60px] bg-thread-bg border-b border-thread-border px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:hidden"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {groupTitle ? (
            <div className="min-w-0">
              <GroupHeader
                conversationId={chatId}
                title={groupTitle}
                memberCount={memberCount}
                onClick={() => setIsGroupSettingsOpen(true)}
              />
              {groupDescription && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {groupDescription}
                </p>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

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
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-thread-bg"
        style={{
          paddingBottom:
            typeof window === 'undefined' || window.innerWidth < 1024
              ? `${composerHeight + 24}px`
              : 0,
        }}
        role="region"
        aria-label="Message history"
        aria-live="polite"
      >
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

        {!isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No messages yet in this conversation.
            </p>
            <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5" />
              <span>Messages are not end-to-end encrypted.</span>
            </div>
          </div>
        )}

        {isLoadingMessages && messages.length === 0 && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`h-10 rounded-2xl animate-pulse ${
                    i % 2 === 0 ? 'bg-slate-200 dark:bg-slate-800 w-48' : 'bg-indigo-200 dark:bg-indigo-900/40 w-40'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUserId;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator =
            !prevMsg ||
            new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <div key={msg.id || msg.clientId}>
              {showDateSeparator && <DateSeparator date={msg.createdAt} />}

              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {groupTitle && (() => {
                  const sender = groupMembers.find((m) => m.userId === msg.senderId);
                  if (!sender) return null;
                  return (
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <IdenticonAvatar
                        seed={sender.avatarSeed || sender.userId}
                        label={sender.displayName || sender.username}
                        size={18}
                      />
                      <span className="font-medium">{sender.displayName || sender.username}</span>
                      <span>@{sender.username}</span>
                    </div>
                  );
                })()}

                <div
                  className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                    isOwn
                      ? 'bg-thread-bubble-mine text-thread-bubble-mine-text rounded-tr-none'
                      : 'bg-thread-bubble-theirs text-thread-bubble-theirs-text border border-thread-border rounded-bl-none'
                  }`}
                >
                  {msg.body}
                </div>

                <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{formatTime(msg.createdAt)}</span>

                  {isOwn && (
                    <>
                      {msg.status === 'sending' && <MessageStatus state="sending" />}
                      {msg.status === 'sent' && <MessageStatus state="sent" />}
                      {msg.status === 'failed' && (
                        <MessageStatus
                          state="failed"
                          onRetry={() => handleSend(msg)}
                        />
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
        className="fixed inset-x-0 z-20 px-3 flex justify-center pointer-events-none lg:static lg:pointer-events-auto lg:inset-x-auto lg:bottom-auto lg:w-auto lg:h-auto lg:px-0 lg:flex-none"
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
            <button
              type="button"
              className="p-2 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Paperclip size={20} />
            </button>
            <textarea
              id="composer-message-input"
              ref={textareaRef}
              rows={1}
              value={inputBody}
              onChange={(e) => {
                setInputBody(e.target.value);
                if (chatId && Date.now() - lastTypingRef.current > 3000) {
                  lastTypingRef.current = Date.now();
                  setTyping(chatId).catch(() => {});
                }
              }}
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

      {isGroupSettingsOpen && groupTitle && (
        <GroupSettingsDrawer
          conversationId={chatId}
          title={groupTitle}
          description={groupDescription}
          createdBy={groupCreatedBy}
          currentUserId={currentUserId}
          onClose={() => setIsGroupSettingsOpen(false)}
          onLeft={() => {
            setIsGroupSettingsOpen(false);
            navigate('/chats');
          }}
        />
      )}

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
