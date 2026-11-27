import { test, expect } from '@playwright/test';
import {
  ROUTES,
  SELECTORS,
  prepareAppUi,
  seedSignedInUser,
  waitForChatHistoryReady,
} from './routes';

const ALICE_CONVERSATION = 'conv-1111-2222';
const BOB_CONVERSATION = 'conv-1111-3333';

test.describe('Focused Thread E2E coverage', () => {
  test.beforeEach(async ({ page }) => {
    await prepareAppUi(page);
  });

  test('sent message is visible in the message history', async ({ page }) => {
    await seedSignedInUser(page);
    await page.goto(ROUTES.chat(ALICE_CONVERSATION));
    await waitForChatHistoryReady(page);

    const history = SELECTORS.chat.messageHistory(page);
    const body = `E2E history message ${Date.now()}`;
    await SELECTORS.chat.messageInput(page).fill(body);
    await SELECTORS.chat.sendButton(page).click();

    await expect(history.getByText(body, { exact: true })).toBeVisible();
    await expect(history.getByRole('img', { name: 'Sent' }).last()).toBeVisible();
  });

  // TODO(source + mock): api.mock.ts has no group conversations — every
  // listConversations() summary is kind:'direct' and createGroup() returns
  // OPERATION_FAILED. In addition, ChatPane renders Report/Block User menu
  // items unconditionally, even when groupTitle is set. Keep this journey
  // skipped until a group conversation can be loaded and the menu is gated.
  test.fixme('group chat actions menu does not offer Report or Block', async ({ page }) => {
    await seedSignedInUser(page);
    await page.goto(ROUTES.chat('conv-group-seed'));

    await SELECTORS.chat.actionsMenuButton(page).click();
    await expect(SELECTORS.chat.reportMenuItem(page)).toHaveCount(0);
    await expect(SELECTORS.chat.blockMenuItem(page)).toHaveCount(0);
  });

  test('desktop sidebar Ask AI opens the AI pane', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium',
      'Desktop-only layout: ChatLayout keeps the sidebar at >=1024px.'
    );

    await seedSignedInUser(page);
    await page.goto(ROUTES.chatList);

    await SELECTORS.ai.askButton(page).click();
    await expect(page).toHaveURL(/\/ai$/);
    await expect(SELECTORS.ai.pane(page)).toBeVisible();
    await expect(SELECTORS.ai.sheet(page)).toHaveCount(0);
  });

  // TODO(source): at tablet widths (768-1023px) Sidebar's Ask AI navigates
  // to /ai, but ChatLayout hides both sidebar and right pane, so nothing is
  // rendered. Add a tablet-specific assertion once that layout is fixed.
  test('mobile sidebar Ask AI opens the AI sheet', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'Mobile Chrome',
      'Mobile-only sheet: the sidebar opens AiChat(variant="sheet") below 768px.'
    );

    await seedSignedInUser(page);
    await page.goto(ROUTES.chatList);

    await SELECTORS.ai.askButton(page).click();
    await expect(SELECTORS.ai.sheet(page)).toBeVisible();
    await expect(SELECTORS.ai.pane(page)).toHaveCount(0);

    await SELECTORS.ai.closeSheetButton(page).click();
    await expect(SELECTORS.ai.sheet(page)).toHaveCount(0);
  });

  test('unread badge filters and clears after opening a conversation', async ({ page }) => {
    await seedSignedInUser(page);
    await page.goto(ROUTES.chatList);

    const bob = SELECTORS.chatList.conversationItem(page, /Bob Jones/i);
    await expect(bob.getByText('1', { exact: true })).toBeVisible();

    await SELECTORS.chatList.unreadFilter(page).click();
    await expect(bob).toBeVisible();
    await SELECTORS.chatList.allFilter(page).click();

    await bob.click();
    await expect(page).toHaveURL(new RegExp(`${BOB_CONVERSATION}$`));
    await expect(SELECTORS.chat.messageHistory(page)).toBeVisible();

    // markRead() has 200-400ms mock latency; wait before re-fetching summaries.
    await page.waitForTimeout(600);
    if (await SELECTORS.chat.backButton(page).isVisible()) {
      await SELECTORS.chat.backButton(page).click();
    }
    await SELECTORS.chatList.refreshButton(page).click();

    await expect(bob.getByText('1', { exact: true })).toHaveCount(0);
  });
});
