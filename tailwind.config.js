/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        thread: {
          accent: 'var(--thread-accent)',
          'accent-2': 'var(--thread-accent-2)',
          'accent-3': 'var(--thread-accent-3)',
          'accent-tint': 'var(--thread-accent-tint)',
          glow: 'var(--thread-glow)',
          shadow: 'var(--thread-shadow)',
          elevated: 'var(--thread-elevated)',
          bg: 'var(--thread-bg)',
          surface: 'var(--thread-surface)',
          'surface-2': 'var(--thread-surface-2)',
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
      borderRadius: {
        thread: 'var(--thread-radius)',
      },
      boxShadow: {
        thread: 'var(--thread-shadow)',
        'thread-glow': 'var(--thread-glow)',
      },
      backgroundImage: {
        'thread-gradient': 'linear-gradient(135deg, var(--thread-accent) 0%, var(--thread-accent-2) 58%, var(--thread-accent-3) 145%)',
      },
      animation: {
        'thread-in': 'thread-fade-in 260ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'thread-sheet': 'thread-sheet-up 300ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'thread-pop': 'thread-pop-in 220ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
      },
      keyframes: {
        'thread-fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'thread-sheet-up': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'thread-pop-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
