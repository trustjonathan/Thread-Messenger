# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\sidebar-screenshots.spec.ts >> Sidebar screenshots >> sidebar 390x844 dark
- Location: tests\e2e\sidebar-screenshots.spec.ts:12:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: Test timeout of 60000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:5173/chats", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const viewports = [
  4  |   { name: '360x640', width: 360, height: 640 },
  5  |   { name: '390x844', width: 390, height: 844 },
  6  |   { name: '1280x720', width: 1280, height: 720 },
  7  | ];
  8  | 
  9  | test.describe('Sidebar screenshots', () => {
  10 |   for (const vp of viewports) {
  11 |     for (const scheme of ['light', 'dark'] as const) {
  12 |       test(`sidebar ${vp.name} ${scheme}`, async ({ page }) => {
  13 |         await page.setViewportSize({ width: vp.width, height: vp.height });
  14 |         await page.emulateMedia({ colorScheme: scheme });
  15 | 
  16 |         // Set mock user in localStorage before navigating
  17 |         await page.addInitScript(() => {
  18 |           localStorage.setItem(
  19 |             'thread_current_user',
  20 |             JSON.stringify({
  21 |               id: '11111111-1111-1111-1111-111111111111',
  22 |               username: 'alice',
  23 |               displayName: 'Alice Smith',
  24 |               usernameSet: true,
  25 |             })
  26 |           );
  27 |         });
  28 | 
> 29 |         await page.goto('http://127.0.0.1:5173/chats');
     |                    ^ Error: page.goto: Test timeout of 60000ms exceeded.
  30 |         await page.waitForTimeout(2000);
  31 | 
  32 |         await expect(page).toHaveURL(/.*\/chats/);
  33 | 
  34 |         await page.screenshot({
  35 |           path: `tests/e2e/screenshots/sidebar-${vp.name}-${scheme}.png`,
  36 |           fullPage: true,
  37 |         });
  38 |       });
  39 |     }
  40 |   }
  41 | });
  42 | 
```