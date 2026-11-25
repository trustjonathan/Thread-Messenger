import PublicLayout from './PublicLayout';
import Seo from './Seo';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/siteConstants';

export default function ContactPage() {
  return (
    <PublicLayout>
      <Seo
        title="Contact Thread"
        description="Contact Thread support or report abuse, safety concerns, and account problems."
        path="/contact"
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Contact Thread</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Contact Thread support for account, privacy, or service questions.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section data-reveal className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold text-slate-950 dark:text-white">Email</h2>
            <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-indigo-700 underline dark:text-indigo-400" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </section>
          <section data-reveal className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold text-slate-950 dark:text-white">Phone</h2>
            <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-indigo-700 underline dark:text-indigo-400" href={`tel:${SUPPORT_PHONE}`}>{SUPPORT_PHONE}</a>
          </section>
        </div>
        <section data-reveal className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-950 dark:text-white">Report abuse</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            To report abuse, harassment, a safety concern, or a Terms of Use violation, email <a className="font-semibold text-indigo-700 underline dark:text-indigo-400" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include the username involved, when it happened, and any message or conversation details you have. Do not include passwords or highly sensitive information.
          </p>
        </section>
      </main>
    </PublicLayout>
  );
}
