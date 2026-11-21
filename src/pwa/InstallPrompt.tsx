import { useState, useEffect, useRef } from 'react';
import { X, Share } from 'lucide-react';

/**
 * The `beforeinstallprompt` event is not in lib.dom.d.ts.
 * We declare it locally here.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'thread-install-dismissed';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !(window.matchMedia?.('(display-mode: standalone)').matches)
  );
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    // If running in standalone mode, don't show
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    // iOS path
    if (isIOS()) {
      setShowIOS(true);
      setVisible(true);
      return;
    }

    // Standard beforeinstallprompt path
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    const result = await deferredPrompt.current.prompt();
    if (result.outcome === 'accepted') {
      deferredPrompt.current = null;
    }
    dismiss();
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
        {showIOS ? (
          <>
            <Share className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm">
              To install: tap the <strong>Share</strong> button, then{' '}
              <strong>Add to Home Screen</strong>.
            </p>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm font-medium">
              Install Thread for a better experience
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-white text-indigo-600 hover:bg-indigo-50 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
            >
              Install
            </button>
          </>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg hover:bg-indigo-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
