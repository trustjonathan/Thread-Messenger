import { ArrowLeft, Bluetooth, Download, Users, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import Seo from '@/features/public/Seo';

const APK_DOWNLOAD_URL =
  'https://github.com/trustjonathan/Thread-Messenger/releases/download/v2.2.0/app-universal-debug.apk';
const RELEASE_URL =
  'https://github.com/trustjonathan/Thread-Messenger/releases/tag/v2.2.0';

const tips = [
  {
    icon: Bluetooth,
    title: 'Stay nearby',
    description:
      'Turn on Bluetooth and keep T-Chat open. Nearby phones can find one another without mobile data or internet Wi-Fi.',
  },
  {
    icon: Users,
    title: 'People can help messages travel',
    description:
      'Other T-Chat users nearby can help pass messages along. The more connected people there are, the farther a message may go.',
  },
  {
    icon: WifiOff,
    title: 'Know when it works',
    description:
      'Offline messages only reach people through nearby T-Chat users. If no one can carry a message closer, it cannot reach someone far away.',
  },
];

export default function TChatPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Seo
        title="T-Chat | Thread"
        description="Learn how T-Chat lets people nearby exchange messages without an internet connection."
        path="/t-chat"
      />
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link
            to="/chats"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-slate-700 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to chats
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16"
      >
        <section className="rounded-3xl bg-indigo-700 px-6 py-10 text-white sm:px-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
            T-Chat for Android
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Chat nearby, even without internet.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-indigo-100 sm:text-lg">
            When mobile data and internet Wi-Fi are unavailable, T-Chat can help
            you exchange messages with people nearby. Your phones connect
            directly, and other T-Chat users nearby may help messages travel
            farther.
          </p>
          <a
            href={APK_DOWNLOAD_URL}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-700"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Download T-Chat for Android
          </a>
          <p className="mt-3 text-sm text-indigo-100">
            Android app · Release 2.2.0 ·{' '}
            <a
              href={RELEASE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2 hover:text-white"
            >
              View release details
            </a>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            How offline chatting works
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
            T-Chat uses Bluetooth to let nearby phones exchange messages
            without an internet connection. If other people using T-Chat are
            nearby, they can help carry a message from phone to phone. This is
            useful when people are together or within reach of one another, but
            it does not provide unlimited, long-distance coverage.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {tips.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <Icon
                  className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-semibold text-slate-950 dark:text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Get started
          </h2>
          <ol className="mt-5 list-inside list-decimal space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            <li>Download and install the Android app.</li>
            <li>Open T-Chat, turn on Bluetooth, and allow nearby-device access when asked.</li>
            <li>Ask the people you want to chat with to do the same, then keep your phones nearby.</li>
          </ol>
          <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            T-Chat offline messaging is for Android. Regular chats on the Thread
            website still need an internet connection. If Android shows an
            installation warning, only continue if you trust this release.
          </p>
        </section>
      </main>
    </div>
  );
}
