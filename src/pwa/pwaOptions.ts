/**
 * PWA options for vite-plugin-pwa.
 *
 * This file is NOT imported by any source code at build time.
 * It is consumed only by the Vite plugin in vite.config.ts.
 * See src/pwa/WIRING.md for integration instructions.
 */
import type { VitePWAOptions } from 'vite-plugin-pwa';

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  manifest: {
    name: 'Thread',
    short_name: 'Thread',
    description: 'Simple text messaging. Find friends by username.',
    display: 'standalone',
    theme_color: '#4f46e5',
    background_color: '#ffffff',
    start_url: '/chats',
    scope: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Cache app shell and static assets ONLY.
    // NEVER cache API calls, realtime WebSocket, or message data.
    globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
    runtimeCaching: [
      {
        // App shell navigation — network-first with a 3 s timeout
        urlPattern: /^\/(?!api|rest|realtime).*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-shell',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
        },
      },
    ],
    navigateFallback: 'index.html',
    // Never cache Supabase API or realtime
    navigateFallbackDenylist: [/^\/rest/, /^\/realtime/, /^\/auth/],
  },
  devOptions: {
    enabled: false,
  },
};

export default pwaOptions;
