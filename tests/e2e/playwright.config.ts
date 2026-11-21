import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.E2E_PORT ?? 5173);
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Playwright E2E configuration for Thread Messenger.
 * Runs tests against the Vite dev server with VITE_USE_MOCK_API=true.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: path.join(os.tmpdir(), 'thread-playwright-results'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_USE_MOCK_API: 'true',
    },
  },
});
