import { IdenticonAvatar } from './IdenticonAvatar';

interface Props {
  conversationId: string;
  title: string;
  memberCount: number;
  onClick: () => void;
}

export function GroupHeader({ conversationId, title, memberCount, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 min-h-[44px] text-left">
      <IdenticonAvatar seed={conversationId} label={title} size={40} variant="initials" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold truncate">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{memberCount} members</span>
      </span>
    </button>
  );
}