import type { FC } from 'react';

export type MessageStatusState = 'sending' | 'queued' | 'failed' | 'sent' | 'delivered' | 'read';

interface Props {
  state: MessageStatusState;
  onRetry?: () => void;
}

const ARIA: Record<MessageStatusState, string> = {
  sending: 'Sending',
  queued: 'Waiting to send',
  failed: 'Not sent',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

export const MessageStatus: FC<Props> = ({ state, onRetry }) => {
  const iconSize = 16;
  const muted = 'text-slate-400 dark:text-slate-500';
  if (state === 'sending' || state === 'queued') {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 16 16"
        role="img"
        aria-label={ARIA[state]}
        className={muted}
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5 V8 L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === 'failed') {
    return (
      <button
        type="button"
        onClick={onRetry}
        aria-label={ARIA.failed}
        className="inline-flex items-center gap-1 text-red-500 min-h-[44px] min-w-[44px] justify-center"
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" role="img" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5 V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.9" fill="currentColor" />
        </svg>
        <span className="text-[11px]">Not sent · Tap to retry</span>
      </button>
    );
  }
  if (state === 'sent') {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 16 16"
        role="img"
        aria-label={ARIA.sent}
        className={muted}
      >
        <path d="M3.5 8.5 L6.5 11.5 L12.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'delivered') {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 16 16"
        role="img"
        aria-label={ARIA.delivered}
        className={muted}
      >
        <path d="M1.5 8.5 L4.5 11.5 L10.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 8.5 L8.5 11.5 L14.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // read
  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 16 16"
      role="img"
      aria-label={ARIA.read}
      className="text-thread-read-tick-light dark:text-thread-read-tick-dark"
    >
      <path d="M1.5 8.5 L4.5 11.5 L10.5 5" fill="currentColor" />
      <path d="M5.5 8.5 L8.5 11.5 L14.5 5" fill="currentColor" />
    </svg>
  );
};

export default MessageStatus;
