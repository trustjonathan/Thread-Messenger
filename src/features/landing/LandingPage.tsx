import {
  ArrowRight,
  Bot,
  Check,
  Download,
  MessageCircle,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicLayout from '../public/PublicLayout';
import Seo from '../public/Seo';

const steps = [
  {
    title: 'Sign in',
    text: 'Sign in with Google to open your Thread account.',
  },
  {
    title: 'Choose a username',
    text: 'Set your username and make it easy for people to find you.',
  },
  {
    title: 'Start a conversation',
    text: 'Find someone by exact username or open a group conversation.',
  },
];

const features = [
  {
    icon: MessageCircle,
    title: 'Text messaging',
    text: 'Send and read text conversations in a focused interface.',
  },
  {
    icon: Search,
    title: 'Username lookup',
    text: 'Find people by their exact Thread username.',
  },
  {
    icon: UsersRound,
    title: 'Groups',
    text: 'Create and manage group conversations.',
  },
  {
    icon: Bot,
    title: 'Thread AI',
    text: 'Ask Thread AI for help from inside the app.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety controls',
    text: 'Block users and report messages or users.',
  },
  {
    icon: Download,
    title: 'Install on your device',
    text: 'Use Thread through supported desktop and mobile browsers.',
  },
];

const faqs = [
  {
    question: 'Do I need an account?',
    answer: 'Yes. Thread uses Google Sign-In to create and identify your account.',
  },
  {
    question: 'Can I change my username?',
    answer: 'The Terms of Use explain your account and username rules.',
  },
  {
    question: 'Can I install Thread?',
    answer: 'On Android Chrome, use the browser menu and choose Install app. On iPhone or iPad Safari, use Share and Add to Home Screen.',
  },
  {
    question: 'Are messages end-to-end encrypted?',
    answer: 'No. Messages are not end-to-end encrypted. Read the Privacy Policy for details about how data is handled.',
  },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <Seo
        title="Thread — Text conversations, made clear"
        description="Sign in to Thread to find people by username, message them, use groups, and chat with Thread AI."
        path="/"
      />
      <main id="main-content" className="overflow-hidden">
        <section data-reveal className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex min-h-8 items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
              Simple text conversations
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Text messaging, made clear.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">
              Find people by username, start a conversation, and keep group chats and Thread AI in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signin"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
              >
                Sign in with Google
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                See how it works
              </a>
            </div>
          </div>

          <figure className="mx-auto w-full max-w-[480px]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
              <img
                src="/thread-connect-chat-belong.jpeg"
                alt="Thread promotional artwork: connect, chat, belong, with a mobile messaging screen."
                width="1280"
                height="720"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              Messages are not end-to-end encrypted.{' '}
              <Link className="font-semibold underline" to="/privacy">Read our privacy details.</Link>
            </figcaption>
          </figure>
        </section>

        <section data-reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">A look inside Thread</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              The same chat list and conversation workspace you use in the app.
            </p>
          </div>
          <figure className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
            <img
              src="/thread-chat-list.png"
              alt="Screenshot of the Thread desktop chat list and conversation workspace"
              width="1440"
              height="900"
              loading="lazy"
              className="h-auto w-full"
            />
            <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              Thread chat list and messaging workspace
            </figcaption>
          </figure>
        </section>

        <section data-reveal id="how-it-works" className="border-y border-slate-200 bg-white px-4 py-16 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">How it works</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <article key={step.title} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Features</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <feature.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <h3 className="mt-4 font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section data-reveal className="bg-slate-100 px-4 py-16 dark:bg-slate-900/70 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Safety controls</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">Use blocking and reporting tools to manage unwanted interactions.</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-indigo-600" aria-hidden="true" />Block users</li>
                <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-indigo-600" aria-hidden="true" />Report messages or users</li>
              </ul>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <Bot className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Thread AI</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">Open the Thread AI chat area to ask questions and continue a conversation.</p>
              <Link to="/signin" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-indigo-200 px-4 font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
                Open Thread
              </Link>
            </article>
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Install Thread as an app</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Android — Chrome</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Open Thread in Chrome, choose Install app from the browser menu or the install prompt, and confirm.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">iPhone or iPad — Safari</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Tap Share, choose Add to Home Screen, then confirm the name and install.</p>
            </article>
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-2">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white">
                  {faq.question}
                  <span className="text-indigo-600 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="pb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section data-reveal className="border-y border-slate-800 bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Connect · Chat · Belong</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Start a conversation on Thread.</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-300">
                Find people by username and bring your conversations together in one place.
              </p>
              <Link
                to="/signin"
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 font-semibold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <img
              src="/thread-wordmark-glow.jpeg"
              alt="Thread wordmark wrapped in a purple thread spool."
              width="1280"
              height="720"
              loading="lazy"
              className="mx-auto h-auto w-full max-w-[320px] rounded-2xl"
            />
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
