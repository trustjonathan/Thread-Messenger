import React from 'react';

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  const formatDate = (isoString: string) => {
    try {
      const target = new Date(isoString);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (target.toDateString() === today.toDateString()) {
        return 'Today';
      }
      if (target.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return target.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: target.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return date;
    }
  };

  return (
    <div
      className="my-5 flex items-center justify-center gap-3"
      role="separator"
      aria-label={formatDate(date)}
    >
      <span aria-hidden="true" className="h-px w-10 bg-gradient-to-r from-transparent to-thread-border sm:w-16" />
      <span className="thread-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
        {formatDate(date)}
      </span>
      <span aria-hidden="true" className="h-px w-10 bg-gradient-to-l from-transparent to-thread-border sm:w-16" />
    </div>
  );
};
