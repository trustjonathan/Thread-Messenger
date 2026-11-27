import { IdenticonAvatar } from './IdenticonAvatar';

interface Props {
  conversationId: string;
  title: string;
  memberCount: number;
  onClick: () => void;
}

export function GroupHeader({ conversationId, title, memberCount, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="thread-focus-ring flex min-h-[44px] items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-thread-soft"
    >
      <IdenticonAvatar seed={conversationId} label={title} size={40} variant="initials" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-thread-text">{title}</span>
        <span className="block text-xs text-thread-muted">{memberCount} members</span>
      </span>
    </button>
  );
}