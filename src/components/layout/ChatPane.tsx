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
} from 'lucide-react';
import { useIsDesktop } from '@/hooks/useMediaQuery';

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
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

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

  // Realtime callbacks read these refs so metadata changes never re-subscribe.
  const groupMembersRef = useRef(groupMembers);
  const otherUserRef = useRef(otherUser);
  const groupTitleRef = useRef(groupTitle);

  useEffect(() => {
    groupMembersRef.current = groupMembers;
    otherUserRef.current = otherUser;
    groupTitleRef.current = groupTitle;
  }, [groupMembers, otherUser, groupTitle]);

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
          const currentGroupTitle = groupTitleRef.current;
          const currentOtherUser = otherUserRef.current;
          const sender = groupMembersRef.current.find(
            (m) => m.userId === incomingMsg.senderId
          );
          const senderName = sender
            ? sender.displayName || sender.username
            : currentOtherUser?.displayName || currentOtherUser?.username || 'Someone';
          const convoTitle =
            currentGroupTitle ||
            currentOtherUser?.displayName ||
            currentOtherUser?.username ||
            'Chat';
          const title =
            incomingMsg.conversationId === chatId && currentGroupTitle
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
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUserId, chatId, triggerMarkRead, fetchInitialMessages]);

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
      <header className="thread-glass z-10 flex h-[68px] shrink-0 items-center justify-between border-x-0 border-t-0 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="thread-focus-ring -ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-thread-muted transition-all hover:scale-105 hover:bg-thread-soft hover:text-thread-accent-2 focus:ring-2 focus:ring-thread-accent lg:hidden"
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
                <p className="truncate text-xs text-thread-muted">{groupDescription}</p>
              )}
            </div>
          ) : (
            <>
              <Avatar name={otherDisplayName} size="sm" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-thread-text">
                  {otherDisplayName}
                </h1>
                {otherUsername && (
                  <p className="truncate text-xs text-thread-muted">@{otherUsername}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="thread-focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-thread-muted transition-all hover:scale-105 hover:bg-thread-soft hover:text-thread-accent-2 focus:ring-2 focus:ring-thread-accent"
            aria-label="Conversation actions"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div
              className="thread-glass thread-animate-pop absolute right-0 z-20 mt-2 w-48 rounded-2xl py-1.5 focus:outline-none"
              role="menu"
            >
              {groupTitle ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsGroupSettingsOpen(true);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-thread-text hover:bg-thread-soft"
                  role="menuitem"
                >
                  <Info className="h-4 w-4 text-thread-accent-2" />
                  <span>Group info</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsReportOpen(true);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-thread-text hover:bg-thread-soft"
                    role="menuitem"
                  >
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    <span>Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsBlockOpen(true);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    role="menuitem"
                  >
                    <UserX className="h-4 w-4" />
                    <span>Block User</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Message List */}
      <div
        ref={messageListContainerRef}
        className="thread-scrollbar flex-1 space-y-4 overflow-y-auto bg-thread-bg p-4 sm:p-6"
        style={{
          paddingBottom: !isDesktop ? `${composerHeight + 24}px` : 0,
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
              className="thread-chip thread-focus-ring min-h-[44px] px-4 py-1.5 text-xs font-medium text-thread-accent-2 disabled:cursor-not-allowed disabled:opacity-70"
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
            className="thread-animate-in flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
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
          <div className="thread-animate-in flex flex-col items-center justify-center px-4 py-16 text-center">
            <div
              aria-hidden="true"
              className="thread-card thread-animate-pop mb-5 flex h-16 w-20 items-end justify-center gap-1.5 p-3"
            >
              <span className="h-4 w-4 rounded-full bg-thread-soft" />
              <span className="h-7 w-4 rounded-full bg-thread-accent-tint" />
              <span className="thread-gradient-bg h-5 w-4 rounded-full" />
            </div>
            <p className="text-sm font-semibold text-thread-text">
              No messages yet in this conversation.
            </p>
            <p className="mt-1.5 text-xs text-thread-muted">
              Say hello to get the thread started.
            </p>
            <div className="thread-chip mt-5 px-3 py-1.5 text-xs">
              <Info className="h-3.5 w-3.5 text-thread-accent-2" />
              <span>Messages are not end-to-end encrypted.</span>
            </div>
          </div>
        )}

        {isLoadingMessages && messages.length === 0 && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`h-10 animate-pulse rounded-2xl ${
                    i % 2 === 0
                      ? 'w-48 bg-thread-soft'
                      : 'w-40 bg-thread-accent-tint'
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
            <div key={msg.id || msg.clientId} className="thread-animate-in">
              {showDateSeparator && <DateSeparator date={msg.createdAt} />}

              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {groupTitle && (() => {
                  const sender = groupMembers.find((m) => m.userId === msg.senderId);
                  if (!sender) return null;
                  return (
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-thread-muted">
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
                  className={`max-w-[80%] whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-[1.45] sm:max-w-md ${
                    isOwn
                      ? 'thread-bubble-own bg-thread-bubble-mine text-thread-bubble-mine-text'
                      : 'thread-bubble-other bg-thread-bubble-theirs text-thread-bubble-theirs-text'
                  }`}
                >
                  {msg.body}
                </div>

                <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-thread-muted">
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
          className="thread-glass pointer-events-auto flex w-full max-w-[672px] flex-col rounded-[20px] p-2 transition-shadow focus-within:border-thread-accent-2 focus-within:ring-2 focus-within:ring-thread-accent-tint"
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
              className="max-h-[144px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-thread-text placeholder:text-thread-muted focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSendDisabled}
              className="thread-gradient-bg thread-focus-ring flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full shadow-thread-glow transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus:ring-2 focus:ring-thread-accent-2"
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
