interface Props {
  className?: string;
  onInviteClick?: () => void;
}

export function EmptyState({ className = '', onInviteClick }: Props) {
  return (
    <div
      className={`m-auto flex max-w-sm flex-col items-center px-6 py-12 text-center ${className}`}
    >
      <div
        aria-hidden="true"
        className="thread-animate-pop relative mb-8 flex h-28 w-36 items-center justify-center"
      >
        <span className="absolute inset-4 rounded-full bg-thread-accent-tint blur-2xl" />
        <div className="thread-card thread-animate-sheet relative w-full rotate-[-4deg] p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="thread-gradient-bg h-7 w-7 shrink-0 rounded-full" />
            <span className="flex flex-1 flex-col items-start gap-1">
              <span className="h-1.5 w-16 rounded-full bg-thread-border" />
              <span className="h-1.5 w-10 rounded-full bg-thread-soft" />
            </span>
          </div>
          <div className="flex justify-end">
            <span className="thread-gradient-bg h-6 w-24 rounded-xl rounded-br-sm opacity-90" />
          </div>
          <div className="mt-2 flex justify-start">
            <span className="h-6 w-20 rounded-xl rounded-bl-sm bg-thread-soft" />
          </div>
        </div>
        <span className="thread-gradient-bg absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full shadow-thread-glow">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>

      <p className="text-xl font-semibold tracking-tight text-thread-text sm:text-2xl">
        Select a chat to start messaging
      </p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-thread-muted">
        Choose a conversation from the sidebar, or bring a friend along to get things going.
      </p>

      {onInviteClick && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onInviteClick}
            className="thread-fab thread-focus-ring min-h-[44px] rounded-full px-5 py-2.5 text-xs font-semibold text-white sm:text-sm"
          >
            Invite friends to Thread
          </button>
        </div>
      )}
    </div>
  );
}
