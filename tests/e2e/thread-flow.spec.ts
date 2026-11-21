import { expect, test } from '@playwright/test';

test.describe('Thread mock-mode user journey', () => {
  // This stays fixme until App wires the route map and these pages/controls exist.
  // It specifically waits for / (landing), /signin, /choose-username, /chats,
  // /chats/:conversationId, and /settings, plus sign-out from settings.
  test.fixme(
    'signs in, chooses a username, chats, blocks, unblocks, and signs out',
    async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /thread messenger/i })).toBeVisible();
      await page.getByRole('link', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/signin$/);

      await page.getByRole('button', { name: /continue with google/i }).click();
      await expect(page).toHaveURL(/\/choose-username$/);

      const username = page.getByRole('textbox', { name: 'Username' });
      await username.fill('ab');
      await expect(page.getByText('At least 3 characters needed.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
      await username.fill('thread_e2e_user');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page).toHaveURL(/\/chats$/);

      const conversations = page.getByRole('list', { name: 'Direct conversations' });
      await expect(conversations.getByRole('button', { name: /Alice Smith/i })).toBeVisible();
      await expect(conversations.getByRole('button', { name: /Bob Jones/i })).toBeVisible();
      await conversations.getByRole('button', { name: /Alice Smith/i }).click();
      await expect(page).toHaveURL(/\/chats\/[^/]+$/);

      const message = page.getByRole('textbox', { name: 'Message body' });
      await message.fill('Hello from the Playwright test.');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expect(page.getByText(/·\s*sending\.\.\.$/i)).toBeVisible();
      await expect(page.getByText('Hello from the Playwright test.', { exact: true })).toBeVisible();
      await expect(page.getByText(/·\s*sent$/i)).toBeVisible();

      await message.fill('/fail-rate');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expect(
        page.getByText("You're sending too fast. Try again in a minute."),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Conversation actions' }).click();
      await page.getByRole('menuitem', { name: 'Block User' }).click();
      const blockDialog = page.getByRole('dialog');
      await expect(blockDialog.getByRole('heading', { name: /block @alice/i })).toBeVisible();
      await blockDialog.getByRole('button', { name: 'Block User' }).click();
      await expect(page).toHaveURL(/\/chats$/);

      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
      const blockedUsers = page.getByRole('list', { name: /blocked users/i });
      await expect(blockedUsers.getByText(/alice/i)).toBeVisible();
      await blockedUsers.getByRole('button', { name: /unblock/i }).click();
      await expect(blockedUsers.getByText(/alice/i)).toHaveCount(0);

      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page).toHaveURL(/\/$/);
    },
  );
});
