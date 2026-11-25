import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import pwaOptions from './src/pwa/pwaOptions';

export default defineConfig(({ command, mode }) => {
  // When VITE_USE_MOCK_API=true, swap @/lib/apiClient → api.mock.ts
  // This is evaluated at build / dev-server start, not at runtime.
  const useMock = process.env.VITE_USE_MOCK_API === 'true';

  // Safety: refuse to produce a production build with mock API unless explicitly overridden.
  if (
    useMock &&
    (command === 'build' || mode === 'production' || process.argv.includes('build')) &&
    process.env.VITE_ALLOW_MOCK_IN_PROD !== 'true'
  ) {
    throw new Error(
      '\n\n❌  Production build failed: VITE_USE_MOCK_API=true is set for a production build.\n' +
      '    This would ship fake in-memory mock data and bypass real authentication.\n' +
      '    Set VITE_USE_MOCK_API=false for production, or explicitly pass VITE_ALLOW_MOCK_IN_PROD=true if intended.\n\n'
    );
  }

  return {
    plugins: [
      react(),
      VitePWA(pwaOptions),
    ],
    resolve: {
      alias: {
        ...(useMock
          ? {
              '@/lib/apiClient': path.resolve(__dirname, './src/lib/api.mock.ts'),
            }
          : {}),
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
