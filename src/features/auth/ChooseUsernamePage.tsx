import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUsername } from '@/lib/apiClient';
import { getPendingInviteCode } from '@/lib/inviteStorage';
import { getHumanErrorMessage } from '../chat/components/ErrorMessage';
import { AlertCircle, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export default function ChooseUsernamePage() {
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrorCode, setApiErrorCode] = useState<string | null>(null);

  const cleanUsername = usernameInput.trim().toLowerCase();
  const isValidFormat = USERNAME_REGEX.test(cleanUsername);

  // Live validation feedback
  const getValidationFeedback = () => {
    if (!usernameInput) return null;
    if (cleanUsername.length < 3) return 'At least 3 characters needed.';
    if (cleanUsername.length > 30) return 'Maximum 30 characters allowed.';
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return 'Only lowercase letters, numbers, and underscores are allowed.';
    }
    return null;
  };

  const validationError = getValidationFeedback();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidFormat || isSubmitting) return;

    setIsSubmitting(true);
    setApiErrorCode(null);

    try {
      const res = await setUsername(cleanUsername);
      if (res?.error) {
        setApiErrorCode(res.error.code);
      } else {
        const pendingInvite = getPendingInviteCode();
        if (pendingInvite) {
          navigate(`/invite/${pendingInvite}`);
        } else {
          navigate('/chats');
        }
      }
    } catch {
      setApiErrorCode('OPERATION_FAILED');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
          <UserCheck className="w-6 h-6" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Choose username
        </h1>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Pick a handle people can use to message you.
        </p>

        {/* Warning: You can choose this only once. */}
        <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs">
          <strong>Note:</strong> You can choose this only once.
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="username-input"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                @
              </span>
              <input
                id="username-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                maxLength={30}
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  if (apiErrorCode) setApiErrorCode(null);
                }}
                placeholder="handle"
                className="w-full pl-8 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                aria-describedby="username-hint"
                disabled={isSubmitting}
                autoFocus
              />
              {isValidFormat && !apiErrorCode && (
                <CheckCircle2
                  className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Live validation message */}
            {validationError ? (
              <p id="username-hint" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validationError}
              </p>
            ) : (
              <p id="username-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                3–30 characters, lowercase letters, numbers, and underscores.
              </p>
            )}
          </div>

          {/* API Error mapping */}
          {apiErrorCode && (
            <div
              className="flex items-center gap-2 p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{getHumanErrorMessage(apiErrorCode)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidFormat || isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Saving username...</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
