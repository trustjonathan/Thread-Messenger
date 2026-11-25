import { Link } from 'react-router-dom';
import PublicLayout from '@/features/public/PublicLayout';
import Seo from '@/features/public/Seo';
import { SUPPORT_EMAIL } from '@/lib/siteConstants';

const sections = [
  ['privacy-overview', 'Overview'],
  ['privacy-data', 'Information we collect'],
  ['privacy-use', 'How we use information'],
  ['privacy-storage', 'Storage and third-party services'],
  ['privacy-retention', 'Retention'],
  ['privacy-account', 'Account deletion'],
  ['privacy-sharing', 'Sharing and disclosure'],
  ['privacy-tracking', 'Cookies and tracking'],
  ['privacy-security', 'Security'],
  ['privacy-rights', 'Your choices'],
  ['privacy-children', 'Children'],
  ['privacy-changes', 'Changes'],
  ['privacy-contact', 'Contact'],
] as const;

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <Seo
        title="Thread Privacy Policy"
        description="Learn what data Thread collects, how it is stored, and how to request account deletion."
        path="/privacy"
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Last updated: November 25, 2026</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Privacy table of contents" className="self-start rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
            <h2 className="font-semibold text-slate-950 dark:text-white">On this page</h2>
            <ol className="mt-3 space-y-1 text-sm text-indigo-700 dark:text-indigo-400">
              {sections.map(([id, title]) => (
                <li key={id}><a className="inline-flex min-h-11 items-center underline" href={`#${id}`}>{title}</a></li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-8 text-sm leading-7 text-slate-700 dark:text-slate-200">
          <section data-reveal>
            <h2 id="privacy-overview" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Overview</h2>
            <p className="mt-3">Thread Messenger operates Thread, a text messaging app. This policy explains how we handle information when you use the app or visit its public pages.</p>
            <p className="mt-3">Messages are not end-to-end encrypted. Thread and its service providers can technically access message content.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-data" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Information we collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Google account information used for authentication, including the account identifier and information made available through Google Sign-In.</li>
              <li>Your Thread username and display name.</li>
              <li>Text messages you send or receive.</li>
              <li>Conversation, group, block, and report records needed to operate and moderate the app.</li>
              <li>Basic service and diagnostic logs needed to operate Thread.</li>
            </ul>
          </section>

          <section data-reveal>
            <h2 id="privacy-use" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">How we use information</h2>
            <p className="mt-3">We use information to authenticate you, provide conversations and groups, deliver messages, operate safety controls, review reports, prevent misuse, maintain the service, and comply with legal obligations.</p>
            <p className="mt-3">We do not sell messages or use them for advertising.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-storage" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Storage and third-party services</h2>
            <p className="mt-3">Thread uses Supabase for authentication, database storage, and hosting functions. Google is used for sign-in. Render is used to host the web app and static pages.</p>
            <p className="mt-3">Data is stored on systems operated by these providers and may be processed in the regions configured for those services. Their own terms and policies apply in addition to this policy.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-retention" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Retention</h2>
            <p className="mt-3">Account and conversation data is retained while the account is active and as needed to provide the service. Report records and records needed for safety, security, or legal obligations may be retained for longer.</p>
            <p className="mt-3">When account deletion is completed, we aim to remove account and message data that we control, subject to records we must keep for safety, security, fraud prevention, or legal requirements.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-account" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Account deletion</h2>
            <p className="mt-3">To request deletion of your account and associated data, email <a className="font-semibold text-indigo-700 underline dark:text-indigo-400" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include the username and Google account used with Thread so we can verify the request.</p>
            <p className="mt-3">Messages already delivered may remain visible to other users. We aim to act on verified deletion requests within 7 days, subject to applicable law and records needed for safety or abuse review.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-sharing" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Sharing and disclosure</h2>
            <p className="mt-3">We may share information with service providers that operate Thread, with the people you send messages to, and with authorities or others when required to comply with law or protect safety.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-tracking" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Cookies and tracking</h2>
            <p className="mt-3">The public Thread website does not use advertising trackers or analytics trackers. Authentication and hosting providers may process technical information required to operate their services.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-security" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Security</h2>
            <p className="mt-3">We take reasonable steps to protect Thread and its data, but no system is completely secure. If a breach affects you, we will notify the people and authorities the law requires us to notify.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-rights" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Your choices</h2>
            <p className="mt-3">You may stop using Thread at any time, use in-app blocking or reporting controls, or contact us to ask about data, deletion, or a privacy concern.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-children" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Children</h2>
            <p className="mt-3">Thread is not intended for children under 18.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-changes" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Changes to this policy</h2>
            <p className="mt-3">We may update this policy. The last updated date above will change, and important changes may also be communicated in the app.</p>
          </section>

          <section data-reveal>
            <h2 id="privacy-contact" className="scroll-mt-24 text-xl font-semibold text-slate-950 dark:text-white">Contact</h2>
            <p className="mt-3">Thread Messenger: <a className="font-semibold text-indigo-700 underline dark:text-indigo-400" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, Kabale district, Uganda.</p>
          </section>
          </div>
        </div>

        <p className="mt-10 text-sm text-slate-600 dark:text-slate-300">
          Read our <Link className="font-semibold underline" to="/terms">Terms of Use</Link>.
        </p>
      </main>
    </PublicLayout>
  );
}
