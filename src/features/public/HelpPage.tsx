import { Link } from 'react-router-dom';
import PublicLayout from './PublicLayout';
import Seo from './Seo';

export default function HelpPage() {
  return (
    <PublicLayout>
      <Seo
        title="Thread Help"
        description="Get help with signing in, usernames, messaging, groups, safety controls, and installing Thread."
        path="/help"
      />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Thread Help</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Use this guide for common Thread account and messaging questions.</p>
        <div className="mt-10 space-y-4">
          {[
            ['Signing in', 'Choose “Sign in with Google” and complete Google Sign-In. If you are signed in for the first time, you will be asked to choose a username.'],
            ['Starting a chat', 'Open a new chat and find the person with their exact username.'],
            ['Creating a group', 'Open the group creation flow from the chat area, add people, and create the conversation.'],
            ['Blocking', 'Open the user or chat controls and choose the block action. A blocked person cannot message you.'],
            ['Reporting', 'Use the report control for a message or person, and include the details needed to review the report.'],
            ['Thread AI', 'Open Thread AI from the app and enter a question. Thread AI is an in-app assistance feature.'],
            ['Installing Thread', 'In Android Chrome, use the browser install action or install prompt. In iPhone or iPad Safari, use Share, then Add to Home Screen.'],
          ].map(([heading, text]) => (
            <section data-reveal key={heading} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-950 dark:text-white">{heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-600 dark:text-slate-300">
          Need more help? Visit <Link className="font-semibold text-indigo-700 underline dark:text-indigo-400" to="/contact">Contact Thread</Link>.
        </p>
      </main>
    </PublicLayout>
  );
}
