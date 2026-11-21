import { test, expect } from '@playwright/test';
import { ROUTES, SELECTORS } from './routes';

test.describe('Thread Messenger E2E User Journeys (Mock Mode)', () => {
  test('App shell serves successfully', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await expect(page).toHaveTitle(/Thread/i);
  });

  test('with real API selected and no session, the app lands on /signin and makes zero RPC calls', async ({ page }) => {
    const rpcCalls: string[] = [];
    await page.route('**/rest/v1/rpc/**', (route) => {
      rpcCalls.push(route.request().url());
      return route.fulfill({ status: 401, body: JSON.stringify({ message: 'UNAUTHENTICATED' }) });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
    expect(rpcCalls).toHaveLength(0);
  });

  test('1. Landing Page presentation', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount LandingPage at '/'
    test.fixme(true, 'Waits for App.tsx router to mount LandingPage at /');

    await page.goto(ROUTES.landing);

    // Hero title & subtitle
    await expect(SELECTORS.landing.heroHeading(page)).toBeVisible();
    await expect(SELECTORS.landing.subtitle(page)).toBeVisible();

    // 3 bullets: text only, exact username, free forever
    await expect(SELECTORS.landing.bulletTextOnly(page)).toBeVisible();
    await expect(SELECTORS.landing.bulletExactUsername(page)).toBeVisible();
    await expect(SELECTORS.landing.bulletFreeForever(page)).toBeVisible();

    // Honest disclosure
    await expect(SELECTORS.landing.unencryptedDisclosure(page)).toBeVisible();

    // CTA button navigates to /signin
    const cta = SELECTORS.landing.getStartedButton(page);
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(ROUTES.signIn);
  });

  test('2. Sign in with Google (Mock Auth)', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount SignInPage at /signin
    test.fixme(true, 'Waits for App.tsx router to mount SignInPage at /signin');

    await page.goto(ROUTES.signIn);

    const googleBtn = SELECTORS.signIn.googleSignInButton(page);
    await expect(googleBtn).toBeVisible();
    await googleBtn.click();

    // After mock sign-in, user without username goes to /choose-username or /chats
    await expect(page).toHaveURL(/\/(choose-username|chats)/);
  });

  test('3. Choose Username with validation errors and success', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount ChooseUsernamePage at /choose-username
    test.fixme(true, 'Waits for App.tsx router to mount ChooseUsernamePage at /choose-username');

    await page.goto(ROUTES.chooseUsername);
    await expect(SELECTORS.chooseUsername.heading(page)).toBeVisible();

    const input = SELECTORS.chooseUsername.usernameInput(page);
    const submit = SELECTORS.chooseUsername.claimButton(page);

    // Test inline validation: too short
    await input.fill('ab');
    await expect(page.getByText('At least 3 characters needed.')).toBeVisible();
    await expect(submit).toBeDisabled();

    // Test inline validation: invalid characters (uppercase/special)
    await input.fill('Invalid-User!');
    await expect(
      page.getByText('Only lowercase letters, numbers, and underscores are allowed.')
    ).toBeVisible();
    await expect(submit).toBeDisabled();

    // Valid username submission
    await input.fill('new_tester_user');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Successful setUsername navigates to /chats
    await expect(page).toHaveURL(ROUTES.chatList);
  });

  test('4. Chat list displays seeded conversations and user handle', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount ChatListPage at /chats
    test.fixme(true, 'Waits for App.tsx router to mount ChatListPage at /chats');

    await page.goto(ROUTES.chatList);
    await expect(SELECTORS.chatList.heading(page)).toBeVisible();

    // Copy username control is available
    await expect(SELECTORS.chatList.copyUsernameButton(page)).toBeVisible();

    // Seeded mock conversations from api.mock.ts
    await expect(SELECTORS.chatList.conversationItem(page, /Alice Smith/i)).toBeVisible();
    await expect(SELECTORS.chatList.conversationItem(page, /Bob Jones/i)).toBeVisible();
    await expect(SELECTORS.chatList.conversationItem(page, /Charlie Brown/i)).toBeVisible();
  });

  test('5. Open chat, send message, verify sending -> sent transitions', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount ChatPage at /chats/:conversationId
    test.fixme(true, 'Waits for App.tsx router to mount ChatPage at /chats/:conversationId');

    const conversationId = 'conv-1111-2222'; // Alice Smith conversation
    await page.goto(ROUTES.chat(conversationId));

    const input = SELECTORS.chat.messageInput(page);
    const sendBtn = SELECTORS.chat.sendButton(page);

    const testMessage = `Automated E2E message at ${Date.now()}`;
    await input.fill(testMessage);
    await sendBtn.click();

    // Message appears immediately with optimistic status
    await expect(page.getByText(testMessage)).toBeVisible();

    // In mock mode (200-400ms latency), message transitions from sending to sent
    await expect(SELECTORS.chat.sentIndicator(page).last()).toBeVisible();
  });

  test('6. Send /fail-rate triggers friendly rate-limit error message', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount ChatPage at /chats/:conversationId
    test.fixme(true, 'Waits for App.tsx router to mount ChatPage at /chats/:conversationId');

    const conversationId = 'conv-1111-2222';
    await page.goto(ROUTES.chat(conversationId));

    const input = SELECTORS.chat.messageInput(page);
    const sendBtn = SELECTORS.chat.sendButton(page);

    // /fail-rate is the designated mock trigger for RATE_LIMITED
    await input.fill('Testing rate limit: /fail-rate');
    await sendBtn.click();

    // Friendly human-readable message must be displayed
    await expect(SELECTORS.chat.rateLimitError(page)).toBeVisible();
  });

  test('7. Block user from chat conversation menu', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount ChatPage at /chats/:conversationId
    test.fixme(true, 'Waits for App.tsx router to mount ChatPage at /chats/:conversationId');

    const conversationId = 'conv-1111-2222';
    await page.goto(ROUTES.chat(conversationId));

    // Open options dropdown
    await SELECTORS.chat.actionsMenuButton(page).click();

    // Click Block User in menu
    const blockMenuItem = SELECTORS.chat.blockMenuItem(page);
    await expect(blockMenuItem).toBeVisible();
    await blockMenuItem.click();

    // Confirm in dialog
    const modal = SELECTORS.chat.blockModal(page);
    await expect(modal).toBeVisible();

    const confirmBtn = SELECTORS.chat.confirmBlockButton(page);
    await confirmBtn.click();

    // Successfully blocking navigates back to /chats
    await expect(page).toHaveURL(ROUTES.chatList);
  });

  test('8. Settings page shows blocked user and allows unblock', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount SettingsPage at /settings
    test.fixme(true, 'Waits for App.tsx router to mount SettingsPage at /settings');

    await page.goto(ROUTES.settings);
    await expect(SELECTORS.settings.heading(page)).toBeVisible();

    // Blocked users section shows user
    await expect(SELECTORS.settings.blockedUsersHeading(page)).toBeVisible();

    // Click unblock
    const unblockBtn = SELECTORS.settings.unblockButton(page).first();
    await expect(unblockBtn).toBeVisible();
    await unblockBtn.click();

    // User is removed from list or empty state appears
    await expect(page.getByText('No blocked users.')).toBeVisible();
  });

  test('9. Sign out from settings navigates back to landing', async ({ page }) => {
    // Waits for Router integration in App.tsx to mount SettingsPage at /settings
    test.fixme(true, 'Waits for App.tsx router to mount SettingsPage at /settings');

    await page.goto(ROUTES.settings);

    const signOutBtn = SELECTORS.settings.signOutButton(page);
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Redirects to landing page (/)
    await expect(page).toHaveURL(ROUTES.landing);
  });

  test('10. Full Complete Journey: Landing -> Auth -> Chat -> Block -> Settings -> Sign Out', async ({
    page,
  }) => {
    // Waits for Router integration in App.tsx to connect all application routes
    test.fixme(true, 'Waits for App.tsx router to integrate all feature routes');

    // Step A: Landing -> Sign In
    await page.goto(ROUTES.landing);
    await SELECTORS.landing.getStartedButton(page).click();
    await expect(page).toHaveURL(ROUTES.signIn);

    // Step B: Sign In with Google
    await SELECTORS.signIn.googleSignInButton(page).click();

    // Step C: If needed, choose username
    if (page.url().includes(ROUTES.chooseUsername)) {
      await SELECTORS.chooseUsername.usernameInput(page).fill('journey_user');
      await SELECTORS.chooseUsername.claimButton(page).click();
    }
    await expect(page).toHaveURL(ROUTES.chatList);

    // Step D: Open first conversation
    const firstConv = SELECTORS.chatList.conversationItem(page, /Alice Smith/i);
    await expect(firstConv).toBeVisible();
    await firstConv.click();
    await expect(page).toHaveURL(/\/chats\/conv-/);

    // Step E: Send a normal message
    const msgText = `Full journey message ${Date.now()}`;
    await SELECTORS.chat.messageInput(page).fill(msgText);
    await SELECTORS.chat.sendButton(page).click();
    await expect(SELECTORS.chat.sentIndicator(page).last()).toBeVisible();

    // Step F: Test error state (/fail-rate)
    await SELECTORS.chat.messageInput(page).fill('Rate limit check /fail-rate');
    await SELECTORS.chat.sendButton(page).click();
    await expect(SELECTORS.chat.rateLimitError(page)).toBeVisible();

    // Step G: Block other user
    await SELECTORS.chat.actionsMenuButton(page).click();
    await SELECTORS.chat.blockMenuItem(page).click();
    await SELECTORS.chat.confirmBlockButton(page).click();
    await expect(page).toHaveURL(ROUTES.chatList);

    // Step H: Navigate to Settings & Unblock
    await page.goto(ROUTES.settings);
    await expect(SELECTORS.settings.blockedUsersHeading(page)).toBeVisible();
    const unblock = SELECTORS.settings.unblockButton(page).first();
    if (await unblock.isVisible()) {
      await unblock.click();
    }

    // Step I: Sign Out -> Landing
    await SELECTORS.settings.signOutButton(page).click();
    await expect(page).toHaveURL(ROUTES.landing);
  });
});
