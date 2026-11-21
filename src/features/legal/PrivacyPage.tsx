import { Link } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

interface Section {
  heading: string;
  todo: string;
}

const sections: Section[] = [
  {
    heading: 'What data we collect',
    todo: 'Account profile from Google Sign-In (name, email address used for authentication only), username, display name, messages you send and receive, block records, report records.',
  },
  {
    heading: 'How your data is stored',
    todo: 'Data is stored on Supabase-hosted PostgreSQL servers. Messages are NOT end-to-end encrypted — service operators can access message content.',
  },
  {
    heading: 'Data retention',
    todo: 'TODO — retention period not yet decided. Document here before launch.',
  },
  {
    heading: 'How to request deletion',
    todo: 'TODO — provide a contact method or in-app deletion flow. Document here before launch.',
  },
  {
    heading: 'Third-party services',
    todo: 'Google Sign-In (authentication). Supabase (database and hosting). List any additional services before launch.',
  },
  {
    heading: 'Contact',
    todo: 'TODO — add contact email or form before launch.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Back link */}
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] py-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Settings
        </Link>

        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>

        {/* Draft banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200">
          <TriangleAlert className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm font-medium">
            DRAFT — to be reviewed by a qualified legal professional before launch. This is a placeholder only.
          </p>
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <section
            key={section.heading}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {section.heading}
            </h2>
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              {section.todo}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
