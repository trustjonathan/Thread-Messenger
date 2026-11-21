import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  username: string;
}

export const BlockModal: React.FC<BlockModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  username,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'That didn’t work. Please try again.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-dialog-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 id="block-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Block @{username}?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              They will not be able to send you messages or start new chats with you.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl min-h-[44px] focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {isSubmitting ? 'Blocking...' : 'Block User'}
          </button>
        </div>
      </div>
    </div>
  );
};
