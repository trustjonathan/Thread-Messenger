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
    globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        // App shell navigation is network-first. Public information routes
        // must never be pinned by a stale service-worker cache.
        urlPattern: /^\/(?!api|rest|realtime|auth|terms(?:\/|$)|privacy(?:\/|$)|help(?:\/|$)|contact(?:\/|$)).*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-shell',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
        },
      },
    ],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [
      /^\/rest/,
      /^\/realtime/,
      /^\/auth/,
      /^\/terms(?:\/|$)/,
      /^\/privacy(?:\/|$)/,
      /^\/help(?:\/|$)/,
      /^\/contact(?:\/|$)/,
    ],
  },
  devOptions: {
    enabled: false,
  },
};

export default pwaOptions;
