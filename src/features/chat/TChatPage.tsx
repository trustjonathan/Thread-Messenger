import { ArrowLeft, Download, MessageCircle, Users, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import Seo from '@/features/public/Seo';

const APK_DOWNLOAD_URL =
  'https://github.com/trustjonathan/Thread-Messenger/releases/latest/download/app-universal-debug.apk';

const tips = [
  {
    icon: MessageCircle,
    title: 'Chat when you are together',
    description:
      'Send messages to people nearby, even when mobile data or Wi-Fi is not available.',
  },
  {
    icon: Users,
    title: 'Stay connected as a group',
    description:
      'People nearby can help messages find their way through your group.',
  },
  {
    icon: WifiOff,
    title: 'Made for nearby conversations',
    description:
      'Thread Chat is designed for people in the same area. It is not a replacement for long-distance messaging.',
  },
];

export default function TChatPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Seo
        title="Thread Chat for Android | Stay connected nearby"
        description="Meet Thread Chat: a simple way to message people nearby, even when internet access is unavailable."
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
            Thread Chat for Android
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Stay in touch, even when you are offline.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-indigo-100 sm:text-lg">
            Thread Chat helps you exchange messages with people around you when
            internet access is unavailable. If others using Thread Chat are
            nearby, they can help messages travel through your group.
          </p>
          <a
            href={APK_DOWNLOAD_URL}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-700"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Download Thread Chat
          </a>
          <p className="mt-3 text-sm text-indigo-100">
            Free to download for Android. Follow the prompts to install.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            A simple way to connect nearby
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
            Whether you are at an event, on campus, or spending time with
            friends, Thread Chat gives your group a simple way to keep the
            conversation going when internet access is out of reach. Messages
            can pass through other nearby Thread Chat users, but everyone needs
            to be within reach of the group.
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
            <li>Download Thread Chat for Android and follow the installation prompts.</li>
            <li>Open the app and choose your display name.</li>
            <li>Invite your friends to join Thread Chat and keep your group nearby.</li>
          </ol>
          <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Thread Chat is currently available for Android. You can also use
            Thread on this website for everyday conversations.
          </p>
        </section>
      </main>
    </div>
  );
}
