import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithGoogle } from '@/lib/apiClient';
import { getHumanErrorMessage } from '../chat/components/ErrorMessage';
import { MessageSquare, RefreshCw } from 'lucide-react';

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorCode(null);
    try {
      const res = await signInWithGoogle();
      if (res?.error) {
        setErrorCode(res.error.code);
      }
    } catch {
      setErrorCode('OPERATION_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col items-center text-center">
        {/* Logo and Name */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-sm shadow-indigo-600/30">
          <MessageSquare className="w-6 h-6" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Thread
        </h1>

        {/* One-line description */}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          A calm, simple public text-messenger.
        </p>

        {/* Primary Action */}
        <div className="w-full mt-8">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Continue with Google</span>
            )}
          </button>

          {/* Friendly Error Display */}
          {errorCode && (
            <div className="mt-3 text-left" role="alert">
              <div className="flex items-center justify-between gap-2 p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300">
                <span>{getHumanErrorMessage(errorCode)}</span>
                {errorCode === 'NETWORK_ERROR' && (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="underline font-medium hover:text-red-800 dark:hover:text-red-200 min-h-[44px] inline-flex items-center"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Note under the button */}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            By continuing you agree to the{' '}
            <Link
              to="/terms"
              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center min-h-[44px] py-1"
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center min-h-[44px] py-1"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
