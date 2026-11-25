import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  getActiveUpdate,
  isUpdateDismissed,
  dismissUpdate,
  type UpdateAnnouncement,
} from '@/lib/updates';

export default function UpdateBanner() {
  const [active, setActive] = useState<UpdateAnnouncement | null>(null);

  const refresh = useCallback(() => {
    const update = getActiveUpdate();
    if (update && !isUpdateDismissed(update.version, update.phase)) {
      setActive(update);
    } else {
      setActive(null);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    const handleFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    const timer = setInterval(refresh, 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, [refresh]);

  if (!active) return null;

  const isDuring = active.phase === 'during';
  const bgClass = isDuring ? 'bg-amber-500' : 'bg-indigo-600';

  const handleDismiss = () => {
    dismissUpdate(active.version, active.phase);
    setActive(null);
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 ${bgClass} text-white text-sm font-medium text-center shadow`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{active.body}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="p-1 text-white/70 hover:text-white hover:opacity-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
