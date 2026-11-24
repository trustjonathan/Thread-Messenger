import { IdenticonAvatar } from './IdenticonAvatar';
import type { GroupMember } from '@/types/api';

interface Props {
  member: GroupMember;
  currentUserId: string | null;
  isCreator: boolean;
  onRemove: (userId: string) => void;
}

export function GroupMemberRow({ member, currentUserId, isCreator, onRemove }: Props) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <IdenticonAvatar seed={member.userId} label={member.displayName || member.username} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{member.displayName || member.username}</span>
          {member.role === 'admin' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">Creator</span>
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">@{member.username}</span>
      </div>
      {isCreator && member.userId !== currentUserId && (
        <button
          type="button"
          onClick={() => onRemove(member.userId)}
          className="text-xs text-red-600 dark:text-red-400 min-h-[44px] px-2"
        >
          Remove
        </button>
      )}
    </div>
  );
}