import { Link } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

interface Section {
  heading: string;
  todo: string;
}

const sections: Section[] = [
  {
    heading: 'Acceptance of terms',
    todo: 'TODO — describe how users accept these terms (e.g., by signing in).',
  },
  {
    heading: 'Who may use this service',
    todo: 'TODO — minimum age, eligibility requirements.',
  },
  {
    heading: 'Prohibited conduct',
    todo: 'TODO — list prohibited behaviours (e.g., harassment, spam, impersonation).',
  },
  {
    heading: 'Content and messages',
    todo: 'TODO — describe ownership of messages, moderation policy.',
  },
  {
    heading: 'Account termination',
    todo: 'TODO — when and how accounts can be suspended or deleted.',
  },
  {
    heading: 'Limitation of liability',
    todo: 'TODO — to be drafted by legal counsel before launch.',
  },
  {
    heading: 'Governing law',
    todo: 'TODO — jurisdiction not yet determined.',
  },
  {
    heading: 'Contact',
    todo: 'TODO — add contact email or form before launch.',
  },
];

export default function TermsPage() {
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

        <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>

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
