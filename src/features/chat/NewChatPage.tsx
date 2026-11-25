import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  searchUserByUsername,
  getOrCreateDirectConversation,
} from '@/lib/apiClient';
import { Avatar } from './components/Avatar';
import { getHumanErrorMessage } from './components/ErrorMessage';
import { ArrowLeft, Search, UserX, Copy, Check, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

interface UserPreview {
  id: string;
  username: string;
  displayName: string;
}

interface NewChatContentProps {
  /** Called when a conversation is opened — navigate to it. */
  onNavigate: (conversationId: string) => void;
  /** Called when the back/close action is taken. */
  onBack: () => void;
  /** If true: renders as a full-height pane (no min-h-screen wrapper). */
  pane?: boolean;
}

/**
 * Shared UI logic for "New chat" — used in both the standalone mobile page
 * and the desktop right-pane embed.
 */
export function NewChatContent({ onNavigate, onBack, pane = false }: NewChatContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [foundUser, setFoundUser] = useState<UserPreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanQuery = searchTerm.trim().toLowerCase();
    if (!cleanQuery || isSearching) return;

    setIsSearching(true);
    setFoundUser(null);
    setNotFound(false);
    setErrorCode(null);

    try {
      const res = await searchUserByUsername(cleanQuery);
      if (res?.error) {
        if (res.error.code === 'NOT_FOUND') {
          setNotFound(true);
        } else {
          setErrorCode(res.error.code);
        }
      } else if (res?.data) {
        setFoundUser(res.data);
      } else {
        setNotFound(true);
      }
    } catch {
      setErrorCode('OPERATION_FAILED');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (userId: string) => {
    if (isCreatingChat) return;
    setIsCreatingChat(true);
    setErrorCode(null);

    try {
      const res = await getOrCreateDirectConversation(userId);
      if (res?.error) {
        setErrorCode(res.error.code);
        setIsCreatingChat(false);
      } else if (res?.data) {
        onNavigate(res.data);
      }
    } catch {
      setErrorCode('OPERATION_FAILED');
      setIsCreatingChat(false);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await navigator.clipboard.writeText(origin);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const inner = (
    <div className={`w-full ${pane ? '' : 'max-w-xl px-4 py-6 flex flex-col flex-1'}`}>
      {/* Navigation header */}
      <header className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Back to chats"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          New chat
        </h1>
      </header>

      {/* Search form: exact username search */}
      <form onSubmit={handleSearch} className="mt-6">
        <label
          htmlFor="username-search-input"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Search by exact username
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
              @
            </span>
            <input
              id="username-search-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                if (errorCode) setErrorCode(null);
                if (notFound) setNotFound(false);
              }}
              placeholder="exact_username"
              className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              disabled={isSearching || isCreatingChat}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchTerm.trim() || isCreatingChat}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            {isSearching ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search</span>
          </button>
        </div>
      </form>

      {/* Error notification */}
      {errorCode && (
        <div
          className="mt-4 flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{getHumanErrorMessage(errorCode)}</span>
          </div>
          {errorCode === 'NETWORK_ERROR' && (
            <button
              type="button"
              onClick={() => handleSearch()}
              className="underline font-medium min-h-[44px] inline-flex items-center"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Search Results */}
      <div className="mt-6 flex-1">
        {foundUser && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={foundUser.displayName || foundUser.username} size="md" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {foundUser.displayName || foundUser.username}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{foundUser.username}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStartChat(foundUser.id)}
              disabled={isCreatingChat}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm shrink-0"
            >
              {isCreatingChat ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </>
              )}
            </button>
          </div>
        )}

        {notFound && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <UserX className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No user with that username
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              They might not have created an account yet. You can invite them to join Thread by sharing the link.
            </p>

            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Link copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy invite link</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (pane) {
    return (
      <div
        className="flex flex-col h-full w-full bg-thread-bg text-thread-text overflow-y-auto px-4 py-6"
        data-testid="new-chat-pane"
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center">
      {inner}
    </div>
  );
}

/**
 * Standalone mobile page — navigates normally.
 */
export default function NewChatPage() {
  const navigate = useNavigate();
  return (
    <NewChatContent
      onNavigate={(id) => navigate(`/chats/${id}`)}
      onBack={() => navigate('/chats')}
    />
  );
}
