import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode: _mode }) => {
  // When VITE_USE_MOCK_API=true, swap @/lib/apiClient → api.mock.ts
  // This is evaluated at build / dev-server start, not at runtime.
  const useMock = process.env.VITE_USE_MOCK_API === 'true';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...(useMock
          ? {
              '@/lib/apiClient': path.resolve(__dirname, './src/lib/api.mock.ts'),
            }
          : {}),
      },
    },
  };
});
