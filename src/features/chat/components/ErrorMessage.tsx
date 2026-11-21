import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function getHumanErrorMessage(code?: string, defaultMessage?: string): string {
  switch (code) {
    case 'RATE_LIMITED':
      return "You're sending too fast. Try again in a minute.";
    case 'OPERATION_FAILED':
      return "That didn't work.";
    case 'NETWORK_ERROR':
      return "You're offline. Check your connection.";
    case 'USERNAME_TAKEN':
      return 'That username is already taken. Please choose another.';
    case 'USERNAME_RESERVED':
      return 'This username is reserved. Please choose another.';
    case 'USERNAME_ALREADY_SET':
      return 'Your username has already been set.';
    case 'VALIDATION_ERROR':
      return 'Please check your input.';
    case 'NOT_FOUND':
      return 'Not found.';
    case 'UNAUTHENTICATED':
      return 'Please sign in to continue.';
    default:
      return defaultMessage || "That didn't work. Please try again.";
  }
}

interface ErrorMessageProps {
  code?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  code,
  message,
  onRetry,
  className = '',
}) => {
  const text = message || getHumanErrorMessage(code);
  const isNetwork = code === 'NETWORK_ERROR';

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-sm ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
        <span>{text}</span>
      </div>
      {(isNetwork || onRetry) && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800/60 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};
