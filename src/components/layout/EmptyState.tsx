interface Props {
  className?: string;
  onInviteClick?: () => void;
}

export function EmptyState({ className = '', onInviteClick }: Props) {
  return (
    <div className={`m-auto px-6 text-center text-slate-500 max-w-sm space-y-4 ${className}`}>
      <p className="text-xl sm:text-2xl font-light text-thread-text">
        Select a chat to start messaging
      </p>
      {onInviteClick && (
        <div>
          <button
            type="button"
            onClick={onInviteClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-thread-accent text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent shadow-sm min-h-[44px]"
          >
            Invite friends to Thread
          </button>
        </div>
      )}
    </div>
  );
}
