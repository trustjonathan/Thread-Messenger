/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        thread: {
          accent: 'var(--thread-accent)',
          bg: 'var(--thread-bg)',
          surface: 'var(--thread-surface)',
          text: 'var(--thread-text)',
          muted: 'var(--thread-muted)',
          border: 'var(--thread-border)',
          soft: 'var(--thread-soft)',
          bubble: {
            theirs: 'var(--thread-bubble-theirs)',
            mine: 'var(--thread-bubble-mine)',
          },
          'bubble-theirs-text': 'var(--thread-bubble-theirs-text)',
          'bubble-mine-text': 'var(--thread-bubble-mine-text)',
          'read-tick-light': 'var(--thread-read-tick-light)',
          'read-tick-dark': 'var(--thread-read-tick-dark)',
        },
      },
    },
  },
  plugins: [],
}
