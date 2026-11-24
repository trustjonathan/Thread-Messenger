import { useState, useCallback } from 'react';
import { Bell, X, RefreshCw } from 'lucide-react';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  requestNotificationPermission,
  isNotificationSupported,
} from '@/lib/notifications';

export default function NotificationPrompt() {
  const [promptEnabled, setPromptEnabled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const shouldShow = useCallback(() => {
    if (dismissed) return false;
    if (!isNotificationSupported()) return false;
    if (typeof window === 'undefined') return false;
    if (window.Notification.permission !== 'default') return false;
    return getNotificationsEnabled();
  }, [dismissed]);

  if (!shouldShow()) return null;

  const handleEnable = async () => {
    setPromptEnabled(true);
    try {
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        setDismissed(true);
      } else {
        setNotificationsEnabled(false);
        setDismissed(true);
      }
    } catch {
      setNotificationsEnabled(false);
      setDismissed(true);
    } finally {
      setPromptEnabled(false);
    }
  };

  const handleNotNow = () => {
    setNotificationsEnabled(false);
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:left-[calc(50%-280px)] z-50 flex flex-col items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg min-h-[80px]"
      role="alert"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Get notified about new messages</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          We’ll show a desktop notification when someone messages you while Thread is in the background.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <button
          type="button"
          onClick={handleEnable}
          disabled={promptEnabled}
          className={`flex-1 min-h-[44px] px-4 py-2 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
            promptEnabled
              ? 'bg-indigo-200 text-indigo-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
          }`}
        >
          {promptEnabled && <RefreshCw className="w-3 h-3 animate-spin mr-2" aria-hidden="true" />}
          Enable notifications
        </button>
        <button
          type="button"
          onClick={handleNotNow}
          disabled={promptEnabled}
          className={`min-h-[44px] px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60`}
        >
          Not now
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
