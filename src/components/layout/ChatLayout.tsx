import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  listConversations,
  subscribeToUserMessages,
  getCurrentUser,
} from '@/lib/apiClient';
import type { ConversationSummary, CurrentUser, Message } from '@/types/api';
import { Sidebar } from './Sidebar';
import { ChatPane } from './ChatPane';
import { EmptyState } from './EmptyState';
import { AiChat } from './AiChat';
import { NewChatContent } from '@/features/chat/NewChatPage';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useResizableSidebar } from '@/hooks/useResizableSidebar';
import { InviteFriendsModal } from '@/features/chat/components/InviteFriendsModal';

export default function ChatLayout() {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const isAiRoute = location.pathname === '/ai';
  const isNewChatRoute = location.pathname === '/chats/new';
  const { width, dragging, handleProps } = useResizableSidebar();

  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const fetchConversations = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    setErrorCode(null);
    try {
      const res = await listConversations();
      if (res?.error) {
        setErrorCode(res.error.code);
      } else if (res?.data) {
        setChats(res.data);
      }
    } catch {
      setErrorCode('OPERATION_FAILED');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

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

  // Realtime subscription — only re-subscribe when user changes, not chatId
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = subscribeToUserMessages(
      currentUser.id,
      (incomingMsg: Message) => {
        const activeId = chatIdRef.current;
        setChats((prev) =>
          prev.map((conv) => {
            if (conv.conversationId !== incomingMsg.conversationId) return conv;

            const isActive = conv.conversationId === activeId;
            const isOwnMessage = incomingMsg.senderId === currentUser.id;
            const newUnread =
              isActive || isOwnMessage
                ? (conv.unreadCount || 0)
                : (conv.unreadCount || 0) + 1;

            return {
              ...conv,
              lastMessage: {
                id: incomingMsg.id,
                body: incomingMsg.body,
                senderId: incomingMsg.senderId,
                createdAt: incomingMsg.createdAt,
              },
              unreadCount: newUnread,
            };
          })
        );
      },
      () => {
        fetchConversations(true);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.id, fetchConversations]);

  const handleSelect = useCallback(
    (id: string) => {
      navigate(`/chats/${id}`);
    },
    [navigate]
  );

  const handleRefresh = () => {
    fetchConversations();
  };

  const handleRetry = () => {
    fetchConversations();
  };

  const handleMessageSent = useCallback(
    (conversationId: string, lastMessage: { body: string; createdAt: string }) => {
      const activeId = chatIdRef.current;
      setChats((prev) =>
        prev.map((conv) => {
          if (conv.conversationId !== conversationId) return conv;
          return {
            ...conv,
            lastMessage: {
              id: '',
              body: lastMessage.body,
              senderId: currentUser?.id ?? '',
              createdAt: lastMessage.createdAt,
            },
            unreadCount: conv.conversationId === activeId ? 0 : conv.unreadCount || 0,
          };
        })
      );
    },
    [currentUser?.id]
  );

  const handleBack = () => {
    navigate('/chats');
  };

  // Keyboard: Esc on desktop closes open chat, AI pane, or new-chat pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDesktop && e.key === 'Escape') {
        if (chatId || isAiRoute || isNewChatRoute) navigate('/chats');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktop, chatId, isAiRoute, isNewChatRoute, navigate]);

  // On desktop the sidebar always stays visible alongside any right-pane view.
  // On mobile only one column is shown at a time:
  //   - no chatId + not special route → sidebar
  //   - chatId present → chat pane only
  //   - /chats/new or /ai → let App.tsx route handle (standalone pages for mobile)
  const showSidebar = isDesktop || (!chatId && !isAiRoute && !isNewChatRoute);
  const showChat = isDesktop || !!chatId || isNewChatRoute;

  return (
    <div
      className={`flex h-dvh w-full overflow-hidden bg-thread-bg text-thread-text ${
        dragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {showSidebar && (
        <aside
          style={isDesktop ? { width } : undefined}
          className="flex h-full w-full shrink-0 flex-col border-r border-thread-border bg-thread-surface dark:bg-thread-bg"
        >
          <Sidebar
            chats={chats}
            activeId={chatId ?? null}
            onSelect={handleSelect}
            currentUser={currentUser}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            errorCode={errorCode}
            onRetry={handleRetry}
          />
        </aside>
      )}

      {isDesktop && (
        <div
          {...handleProps}
          title="Drag to resize · double-click to reset"
          className={`relative z-10 -ml-px w-1 shrink-0 cursor-col-resize transition-colors ${
            dragging ? 'thread-gradient-bg' : 'bg-transparent hover:bg-thread-soft'
          }`}
        >
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {showChat && (
        <main className="flex h-full min-w-0 flex-1 flex-col">
          {isLoading ? (
            <div className="flex h-full items-center justify-center" role="status" aria-label="Loading conversations">
              <div className="h-8 w-8 animate-pulse rounded-full border-2 border-thread-soft border-t-thread-accent-2" />
            </div>
          ) : isDesktop && isAiRoute ? (
            /* Desktop: AI view in right pane — sidebar still visible */
            <AiChat variant="pane" onClose={() => navigate('/chats')} />
          ) : isDesktop && isNewChatRoute ? (
            /* Desktop: New-chat search in right pane — sidebar still visible */
            <NewChatContent
              pane
              onNavigate={(id) => navigate(`/chats/${id}`)}
              onBack={() => navigate('/chats')}
            />
          ) : isNewChatRoute ? (
            /* Mobile: New-chat fills the screen (sidebar hidden) */
            <NewChatContent
              onNavigate={(id) => navigate(`/chats/${id}`)}
              onBack={() => navigate('/chats')}
            />
          ) : !chatId && isDesktop ? (
            <EmptyState onInviteClick={() => setIsInviteModalOpen(true)} />
          ) : chatId ? (
            <ChatPane
              chatId={chatId}
              onBack={handleBack}
              onMessageSent={handleMessageSent}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      )}

      <InviteFriendsModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
