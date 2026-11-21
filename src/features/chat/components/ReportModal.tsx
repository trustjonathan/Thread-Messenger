import { useState, type FormEvent } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  targetName: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  targetName,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setErrorMessage('Please provide a reason with at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'That didn’t work. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 id="report-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Report {targetName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="report-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for report
            </label>
            <textarea
              id="report-reason"
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Please describe why you are reporting this content..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSubmitting}
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Minimum 3 characters
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl min-h-[44px] focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
