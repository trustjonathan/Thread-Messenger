/**
 * AiChat – shared AI assistant chat component.
 *
 * Desktop (md+): rendered inline in the right chat pane (no overlay).
 * Mobile (<md):  rendered inside a full-height slide-up sheet with a close arrow.
 *
 * Implements:
 * - Immediate SSE streaming via `streamAiPrompt`; tokens render as they arrive.
 * - Full AI reply layout without cards/bubbles (text directly on bg, max-w-[70ch]).
 * - User messages in right-aligned accent bubbles (#4f46e5).
 * - Copy button under completed AI replies (raw Markdown) + fallback + 2s check feedback.
 * - Header menu with "Copy chat" (Markdown format: "You:" / "Thread AI:").
 * - Auto-scroll with scroll-up detection and "Jump to latest" button.
 * - Stop button (AbortController) keeping partial text.
 * - Retry resends from the last user turn with clean history.
 * - In-memory history cleared on panel exit. Thread AI has no quota or cooldown.
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Square,
  Copy,
  Check,
  ChevronDown,
  MoreVertical,
  RotateCcw,
} from 'lucide-react';
import { AI_NAME } from '@/lib/constants';
import { streamAiPrompt } from '@/lib/apiClient';
import type { AiChatTurn } from '@/types/api';
import { MessageRenderer } from '@/components/chat/MessageRenderer';
import { copyTextToClipboard } from '@/lib/clipboard';

interface Props {
  variant: 'pane' | 'sheet';
  onClose: () => void;
}

export interface UiAiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
  isInterrupted?: boolean;
  stoppedByUser?: boolean;
}

export function AiChat({ variant, onClose }: Props) {
  const [messages, setMessages] = useState<UiAiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyChatStatus, setCopyChatStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Streaming state (tokens are applied immediately, without pacing buffers)
  const currentMsgIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const showScrollBottomRef = useRef(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when sheet is open on mobile
  useEffect(() => {
    if (variant === 'sheet') {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [variant]);

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Abort an in-flight response if the assistant is closed mid-stream.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Scroll detection to show "jump to latest"
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldShow = distanceToBottom > 80;
    showScrollBottomRef.current = shouldShow;
    setShowScrollBottom(shouldShow);
  };

  const scrollToBottom = (smooth = true) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  // Announce copy action for screen readers
  const announce = (text: string) => {
    setAnnouncement(text);
    setTimeout(() => setAnnouncement(''), 3000);
  };

  const toHistory = (list: UiAiMessage[]): AiChatTurn[] =>
    list
      .filter((m) => m.text.trim().length > 0 && !m.isInterrupted && !m.stoppedByUser)
      .map((m) => ({ role: m.role, text: m.text }));

  const submitPrompt = async (prompt: string, history: AiChatTurn[]) => {
    const userMsgId = `u-${Date.now()}`;
    const aiMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: prompt },
      { id: aiMsgId, role: 'assistant', text: '', isStreaming: true },
    ]);
    setInput('');
    setErrorMsg(null);
    setIsStreaming(true);
    setIsTyping(true);
    currentMsgIdRef.current = aiMsgId;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let hasReceivedFirstChunk = false;
    scrollToBottom(true);

    await streamAiPrompt({
      prompt,
      history,
      signal: controller.signal,
      onChunk: (chunk: string) => {
        if (!hasReceivedFirstChunk) {
          hasReceivedFirstChunk = true;
          setIsTyping(false);
        }
        // Render tokens immediately — no artificial pacing buffer.
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, text: m.text + chunk } : m))
        );
        if (!showScrollBottomRef.current) scrollToBottom(false);
      },
      onDone: () => {
        setIsStreaming(false);
        setIsTyping(false);
        currentMsgIdRef.current = null;
        abortControllerRef.current = null;
      },
      onError: (err) => {
        if (controller.signal.aborted) return;
        setIsStreaming(false);
        setIsTyping(false);
        currentMsgIdRef.current = null;
        abortControllerRef.current = null;

        if (hasReceivedFirstChunk) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, isInterrupted: true, isStreaming: false } : m
            )
          );
        } else {
          // Remove the empty assistant turn and surface a clean, typed error.
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
          setErrorMsg(err.message || 'Failed to get a response from Thread AI.');
        }
      },
    });
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const currentId = currentMsgIdRef.current;
    if (currentId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentId
            ? { ...m, isStreaming: false, stoppedByUser: true }
            : m
        )
      );
    }
    currentMsgIdRef.current = null;
    setIsStreaming(false);
    setIsTyping(false);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt || isStreaming || isTyping) return;
    await submitPrompt(prompt, toHistory(messages));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Copy single AI message (raw Markdown including LaTeX)
  const handleCopyMessage = async (msg: UiAiMessage) => {
    const rawMarkdown = msg.text;
    const msgEl = document.getElementById(`msg-body-${msg.id}`);
    const res = await copyTextToClipboard(rawMarkdown, msgEl);

    if (res.success) {
      setCopiedMessageId(msg.id);
      announce('Copied reply to clipboard');
      setTimeout(() => setCopiedMessageId(null), 2000);
    } else {
      announce(res.fallbackSelectionMade ? "Couldn't copy — text selected" : "Couldn't copy");
    }
  };

  // Copy whole chat conversation
  const handleCopyChat = async () => {
    if (messages.length === 0 || isStreaming) return;
    setMenuOpen(false);

    const formatted = messages
      .map((m) => `${m.role === 'user' ? 'You:' : 'Thread AI:'}\n${m.text}`)
      .join('\n\n');

    const res = await copyTextToClipboard(formatted);
    if (res.success) {
      setCopyChatStatus('copied');
      announce('Chat copied to clipboard');
      setTimeout(() => setCopyChatStatus('idle'), 2000);
    } else {
      setCopyChatStatus('error');
      announce("Couldn't copy chat");
      setTimeout(() => setCopyChatStatus('idle'), 2000);
    }
  };

  const handleRetryLast = () => {
    if (isStreaming || isTyping) return;
    let userIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        userIndex = i;
        break;
      }
    }
    if (userIndex < 0) return;

    const prompt = messages[userIndex].text;
    const history = toHistory(messages.slice(0, userIndex));
    // Drop the failed turn and everything after it, then resend cleanly.
    setMessages((prev) => prev.slice(0, userIndex));
    setErrorMsg(null);
    void submitPrompt(prompt, history);
  };

  const header = (
    <header className="shrink-0 h-[60px] border-b border-thread-border px-4 flex items-center justify-between gap-3 bg-thread-bg">
      <div className="flex items-center gap-3 min-w-0">
        {variant === 'sheet' && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl text-thread-muted hover:bg-thread-soft min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
            aria-label="Close AI assistant"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Sparkles className="w-5 h-5 text-thread-accent shrink-0" aria-hidden="true" />
        <h1 className="text-sm font-semibold text-thread-text truncate">{AI_NAME}</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Menu for Copy chat */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-xl text-thread-muted hover:text-thread-text hover:bg-thread-soft min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
            aria-label="AI options"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-thread-surface border border-thread-border shadow-lg py-1 z-30">
              <button
                type="button"
                onClick={handleCopyChat}
                disabled={messages.length === 0 || isStreaming}
                className="w-full px-3.5 py-2 text-left text-xs text-thread-text hover:bg-thread-soft disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between transition-colors focus:outline-none focus:bg-thread-soft"
              >
                <span>{copyChatStatus === 'copied' ? 'Chat copied!' : 'Copy chat'}</span>
                {copyChatStatus === 'copied' ? (
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-thread-muted" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );

  const body = (
    <>
      {/* Screen reader polite announcement region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 bg-thread-bg relative"
      >
        <div className="max-w-[70ch] mx-auto w-full space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center min-h-[240px] text-center px-4">
              <div className="w-12 h-12 rounded-full bg-thread-soft text-thread-accent flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-thread-text">
                Ask {AI_NAME} anything
              </p>
              <p className="text-xs text-thread-muted mt-1 max-w-sm">
                Get full explanations, step-by-step problem solving, and science notation.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            if (isUser) {
              return (
                <div key={msg.id} className="flex flex-col items-end w-full">
                  <div
                    data-testid="user-message"
                    className="max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl rounded-tr-none bg-thread-bubble-mine text-thread-bubble-mine-text text-sm whitespace-pre-wrap break-words shadow-sm"
                  >
                    {msg.text}
                  </div>
                </div>
              );
            }

            // AI Message: sitting directly on page background, no card/bubble
            const isCurrentStreaming = msg.isStreaming && isStreaming;
            const canCopy =
              !isCurrentStreaming &&
              (Boolean(msg.text) && (!msg.isInterrupted || msg.stoppedByUser));
            const isCopied = copiedMessageId === msg.id;

            return (
              <div
                key={msg.id}
                data-testid="ai-message"
                className="ai-response-item flex flex-col items-start w-full"
              >
                {/* Thread AI label with Sparkles icon above reply */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-thread-muted mb-1.5 select-none">
                  <Sparkles className="w-3.5 h-3.5 text-thread-accent" aria-hidden="true" />
                  <span>{AI_NAME}</span>
                </div>

                {/* AI response content */}
                <div id={`msg-body-${msg.id}`} className="w-full text-thread-text text-base">
                  <MessageRenderer
                    content={msg.text}
                    isStreaming={isCurrentStreaming}
                  />
                </div>

                {/* Interrupted status */}
                {msg.isInterrupted && (
                  <div className="mt-2 text-xs text-thread-muted flex items-center gap-2">
                    <span>Interrupted.</span>
                    <button
                      type="button"
                      onClick={handleRetryLast}
                      className="text-thread-accent hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}

                {/* Action bar under completed AI reply: raw Markdown copy button */}
                {canCopy && (
                  <div className="mt-2 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="min-h-[44px] min-w-[44px] -ml-2 px-2 py-1.5 rounded-lg text-xs text-thread-muted hover:text-thread-text hover:bg-thread-soft flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
                      aria-label={isCopied ? 'Copied' : 'Copy reply'}
                      title="Copy reply"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                          <span className="font-medium text-green-600 dark:text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" aria-hidden="true" />
                          <span className="font-medium">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator before first chunk arrives */}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-thread-muted py-1">
              <Sparkles className="w-3.5 h-3.5 text-thread-accent animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}

          {errorMsg && (
            <div
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2"
              role="alert"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={handleRetryLast}
                className="underline font-medium shrink-0 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Jump to latest floating button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="fixed bottom-24 right-6 md:right-8 z-20 p-2.5 rounded-full bg-thread-surface border border-thread-border text-thread-muted hover:text-thread-text shadow-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-thread-accent"
            aria-label="Jump to latest"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      <footer className="shrink-0 p-3 border-t border-thread-border bg-thread-bg">
        <form
          onSubmit={handleSubmit}
          className="max-w-[70ch] mx-auto bg-thread-surface border border-thread-border rounded-3xl shadow-sm p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-thread-accent"
        >
          <label htmlFor="ai-prompt-input" className="sr-only">
            Message {AI_NAME}
          </label>
          <textarea
            id="ai-prompt-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={1000}
            disabled={isStreaming}
            placeholder={`Ask ${AI_NAME}...`}
            className="flex-1 min-h-[44px] max-h-[144px] py-2.5 px-3 bg-transparent text-sm text-thread-text placeholder:text-thread-muted resize-none focus:outline-none leading-relaxed"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop generation"
              className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 bg-thread-soft text-thread-text hover:bg-thread-border transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send prompt"
              className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 bg-thread-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </footer>
    </>
  );

  if (variant === 'pane') {
    return (
      <div
        className="flex flex-col h-full w-full bg-thread-bg text-thread-text"
        data-testid="ai-pane"
      >
        {header}
        {body}
      </div>
    );
  }

  /* variant === 'sheet' — mobile slide-up */
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex flex-col bg-thread-bg text-thread-text"
        role="dialog"
        aria-modal="true"
        aria-label={AI_NAME}
        data-testid="ai-sheet"
      >
        {header}
        {body}
      </div>
    </>
  );
}
