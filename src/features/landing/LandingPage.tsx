import { Link } from 'react-router-dom';
import { MessageSquare, Check } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col items-center text-center">

        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-sm shadow-indigo-600/30">
          <MessageSquare className="w-6 h-6" aria-hidden="true" />
        </div>

        {/* Hero */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Simple text messaging.
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Find friends by username.
        </p>

        {/* Bullet points */}
        <ul className="mt-6 w-full space-y-3 text-left">
          {[
            'Text only — no images, no noise.',
            'Find people by exact username, nothing more.',
            'Free to use, forever.',
          ].map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">{point}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="w-full mt-8">
          <Link
            to="/signin"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Get started
          </Link>

          {/* Honest note */}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Messages are stored on our servers and are not end-to-end encrypted.
          </p>
        </div>

      </div>
    </main>
  );
}
