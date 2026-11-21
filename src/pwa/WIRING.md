# PWA Wiring Guide

> **Who does this?** The coordinator / DBA — not individual builders.
> This involves editing `vite.config.ts`, which is NOT a builder-scoped file.

---

## 1. Install vite-plugin-pwa

```bash
npm install -D vite-plugin-pwa@^0.21.0
```

Add to `DEPS.md` under devDependencies:

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `vite-plugin-pwa` | `^0.21.0` | Service worker generation, manifest, and offline shell |

---

## 2. Update vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import pwaOptions from './src/pwa/pwaOptions';

export default defineConfig(({ mode: _mode }) => {
  const useMock = process.env.VITE_USE_MOCK_API === 'true';

  return {
    plugins: [
      react(),
      VitePWA(pwaOptions),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...(useMock
          ? { '@/lib/apiClient': path.resolve(__dirname, './src/lib/api.mock.ts') }
          : {}),
      },
    },
  };
});
```

---

## 3. Mount components in App.tsx or your root layout

Add at the root level, **outside** any `<Routes>`:

```tsx
import InstallPrompt from '@/pwa/InstallPrompt';
import OfflineBanner from '@/pwa/OfflineBanner';

function App() {
  return (
    <>
      <OfflineBanner />
      {/* Your router / routes here */}
      <InstallPrompt />
    </>
  );
}
```

`OfflineBanner` renders a fixed bar at the top when offline.
`InstallPrompt` renders a fixed banner at the bottom for install prompts.

---

## 4. Place icons in public/icons/

Required files (placeholder PNGs are already provided):

| File | Size | Notes |
|------|------|-------|
| `icon-192.png` | 192×192 | Standard app icon |
| `icon-512.png` | 512×512 | Standard app icon |
| `icon-maskable-512.png` | 512×512 | Maskable — safe zone is centre 80% |

---

## 5. Place favicon.svg in public/

Add to `index.html` inside `<head>`:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

---

## 6. Verify

```bash
npm run build
```

Check `dist/` for:
- `sw.js` (service worker)
- `manifest.webmanifest` (web app manifest)

---

## Important

- **Never** cache `/rest/v1/**`, `/realtime/**`, `/auth/**`, or any API endpoint.
- The service worker must **not** intercept POST requests.
- Test offline mode: Chrome DevTools → Application → Service Workers → Offline.
- The `pwaOptions.ts` sets `devOptions.enabled = false` — the service worker is **not active** during `npm run dev`. Build and serve with `npm run preview` to test.
