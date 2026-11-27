import { test, expect } from '@playwright/test';

const viewports = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x720', width: 1280, height: 720 },
];

test.describe('Sidebar screenshots', () => {
  for (const vp of viewports) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`sidebar ${vp.name} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: scheme });

        // Set mock user in localStorage before navigating
        await page.addInitScript(() => {
          localStorage.setItem(
            'thread_current_user',
            JSON.stringify({
              id: '11111111-1111-1111-1111-111111111111',
              username: 'alice',
              displayName: 'Alice Smith',
              usernameSet: true,
            })
          );
        });

        // Use Playwright's configured baseURL (honours E2E_PORT) instead of a
        // hardcoded localhost:5173.
        await page.goto('/chats');
        await page.waitForTimeout(2000);

        await expect(page).toHaveURL(/.*\/chats/);

        await page.screenshot({
          path: `tests/e2e/screenshots/sidebar-${vp.name}-${scheme}.png`,
          fullPage: true,
        });
      });
    }
  }
});
