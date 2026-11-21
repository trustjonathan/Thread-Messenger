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
    <div className="flex items-center justify-center my-4" role="separator" aria-label={formatDate(date)}>
      <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        {formatDate(date)}
      </span>
    </div>
  );
};
