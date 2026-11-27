import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import {
  SITE_OPERATOR,
  SUPPORT_EMAIL,
} from '@/lib/siteConstants';
import {
  applyTheme,
  readThemeOverride,
  resolveDarkTheme,
  saveThemeOverride,
  type ThemeOverride,
} from '@/lib/theme';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(readThemeOverride);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const dark = resolveDarkTheme(themeOverride, systemDark);

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    colorScheme.addEventListener('change', updateSystemTheme);
    return () => colorScheme.removeEventListener('change', updateSystemTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = dark ? 'light' : 'dark';
    setThemeOverride(nextTheme);
    saveThemeOverride(nextTheme);
  };

  useEffect(() => {
    const revealTargets = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      revealTargets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            currentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealTargets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-lg bg-white px-4 py-3 font-semibold text-slate-950 focus:not-sr-only"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Thread home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white" aria-hidden="true">T</span>
            <span className="text-lg font-bold tracking-tight">Thread</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-900"
              aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            >
              {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <Link
              to="/signin"
              className="ml-1 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with Google</span>
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-slate-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
            <Link className="min-h-11 py-3 hover:text-indigo-600 dark:hover:text-indigo-400" to="/terms">Terms</Link>
            <Link className="min-h-11 py-3 hover:text-indigo-600 dark:hover:text-indigo-400" to="/privacy">Privacy</Link>
            <Link className="min-h-11 py-3 hover:text-indigo-600 dark:hover:text-indigo-400" to="/help">Help</Link>
            <Link className="min-h-11 py-3 hover:text-indigo-600 dark:hover:text-indigo-400" to="/contact">Contact</Link>
          </nav>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Messages aren&apos;t end-to-end encrypted. Read how we handle your data in our <Link className="font-semibold underline" to="/privacy">Privacy Policy</Link>.
          </p>
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {SITE_OPERATOR}. <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
