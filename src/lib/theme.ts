export type ThemeOverride = 'light' | 'dark' | null;

export function readThemeOverride(): ThemeOverride {
  if (typeof window === 'undefined') return null;

  try {
    const theme = window.localStorage.getItem('thread-theme');
    return theme === 'light' || theme === 'dark' ? theme : null;
  } catch (error) {
    console.warn('[theme] Unable to read the saved theme preference.', error);
    return null;
  }
}

export function resolveDarkTheme(override: ThemeOverride, systemDark: boolean): boolean {
  return override ? override === 'dark' : systemDark;
}

export function applyTheme(dark: boolean): void {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function saveThemeOverride(theme: Exclude<ThemeOverride, null>): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('thread-theme', theme);
    } catch (error) {
      console.warn('[theme] Unable to save the theme preference.', error);
    }
  }
}
