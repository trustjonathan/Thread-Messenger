import type { Page } from '@playwright/test';

/**
 * Common Route Map for Thread Messenger.
 * Centralizes application URLs and role/label-based selectors.
 */
export const ROUTES = {
  landing: '/',
  signIn: '/signin',
  chooseUsername: '/choose-username',
  chatList: '/chats',
  chat: (conversationId: string) => `/chats/${conversationId}`,
  newChat: '/chats/new',
  settings: '/settings',
  ai: '/ai',
  privacy: '/privacy',
  terms: '/terms',
} as const;

/**
 * Role- and label-based selectors for each page.
 * Never uses CSS class names or fragile markup structure.
 */
export const SELECTORS = {
  landing: {
    heroHeading: (page: Page) =>
      page.getByRole('heading', { name: 'Text messaging, made clear.', level: 1 }),
    subtitle: (page: Page) =>
      page.getByText(
        'Find people by username, start a conversation, and keep group chats and Thread AI in one place.'
      ),
    featureTextMessaging: (page: Page) =>
      page.getByRole('heading', { name: 'Text messaging', exact: true }),
    featureUsernameLookup: (page: Page) =>
      page.getByRole('heading', { name: 'Username lookup' }),
    featureGroups: (page: Page) => page.getByRole('heading', { name: 'Groups' }),
    getStartedButton: (page: Page) =>
      page.getByRole('link', { name: 'Get started' }),
    unencryptedDisclosure: (page: Page) =>
      page.getByText(/Messages are not end-to-end encrypted\./).first(),
  },

  signIn: {
    heading: (page: Page) =>
      page.getByRole('heading', { name: 'Thread', level: 1 }),
    googleSignInButton: (page: Page) =>
      page.getByRole('button', { name: 'Continue with Google' }),
    termsLink: (page: Page) =>
      page.getByRole('link', { name: 'Terms' }),
    privacyLink: (page: Page) =>
      page.getByRole('link', { name: 'Privacy Policy' }),
  },

  chooseUsername: {
    heading: (page: Page) =>
      page.getByRole('heading', { name: 'Choose username', level: 1 }),
    usernameInput: (page: Page) =>
      page.getByRole('textbox', { name: 'Username' }),
    claimButton: (page: Page) =>
      page.getByRole('button', { name: 'Continue' }),
    errorAlert: (page: Page) =>
      page.getByRole('alert'),
  },

  chatList: {
    heading: (page: Page) =>
      page.getByRole('heading', { name: /Thread|Chats/, level: 1 }),
    menuButton: (page: Page) => page.getByRole('button', { name: 'Menu' }),
    newChatButton: (page: Page) =>
      page.getByRole('button', { name: 'New chat' }),
    refreshButton: (page: Page) =>
      page.getByRole('button', { name: 'Refresh conversations' }),
    // ChatLayout exposes "Copy my username" in the sidebar overflow menu.
    copyUsernameButton: (page: Page) =>
      page.getByRole('menuitem', { name: /Copy my username/ }),
    unreadFilter: (page: Page) =>
      page.getByRole('button', { name: 'Unread', exact: true }),
    allFilter: (page: Page) =>
      page.getByRole('button', { name: 'All', exact: true }),
    list: (page: Page) =>
      page.getByRole('list', { name: 'Direct conversations' }),
    conversationItem: (page: Page, namePattern: string | RegExp) =>
      SELECTORS.chatList.list(page).getByRole('button', { name: namePattern }),
  },

  chat: {
    backButton: (page: Page) =>
      page.getByRole('button', { name: 'Back to chats' }),
    actionsMenuButton: (page: Page) =>
      page.getByRole('button', { name: 'Conversation actions' }),
    reportMenuItem: (page: Page) =>
      page.getByRole('menuitem', { name: 'Report' }),
    blockMenuItem: (page: Page) =>
      page.getByRole('menuitem', { name: 'Block User' }),
    blockModal: (page: Page) =>
      page.getByRole('dialog', { name: /Block @/ }),
    confirmBlockButton: (page: Page) =>
      page.getByRole('button', { name: 'Block User' }),
    messageHistory: (page: Page) =>
      page.getByRole('region', { name: 'Message history' }),
    messageInput: (page: Page) =>
      page.getByRole('textbox', { name: 'Message', exact: true }),
    sendButton: (page: Page) =>
      page.getByRole('button', { name: 'Send message' }),
    sendingIndicator: (page: Page) =>
      page.getByRole('img', { name: 'Sending' }),
    sentIndicator: (page: Page) =>
      page.getByRole('img', { name: 'Sent' }),
    // Send failures currently render only the generic retry affordance; the
    // human-readable error code is not surfaced in the chat UI.
    sendFailureNotice: (page: Page) =>
      page.getByRole('button', { name: 'Not sent' }),
    rateLimitError: (page: Page) =>
      page.getByText("You're sending too fast. Try again in a minute."),
  },

  ai: {
    pane: (page: Page) => page.getByTestId('ai-pane'),
    sheet: (page: Page) => page.getByTestId('ai-sheet'),
    askButton: (page: Page) => page.getByRole('button', { name: 'Ask AI' }),
    closeSheetButton: (page: Page) =>
      page.getByRole('button', { name: 'Close AI assistant' }),
  },

  settings: {
    heading: (page: Page) =>
      page.getByRole('heading', { name: 'Settings', level: 1 }),
    copyUsernameButton: (page: Page) =>
      page.getByRole('button', { name: 'Copy username' }),
    displayNameInput: (page: Page) =>
      page.getByRole('textbox', { name: 'Display name' }),
    saveDisplayNameButton: (page: Page) =>
      page.getByRole('button', { name: 'Save' }),
    blockedUsersHeading: (page: Page) =>
      page.getByRole('heading', { name: 'Blocked users', level: 2 }),
    blockedUsersSection: (page: Page) =>
      page
        .locator('section')
        .filter({ has: SELECTORS.settings.blockedUsersHeading(page) }),
    unblockButton: (page: Page) =>
      page.getByRole('button', { name: 'Unblock' }),
    privacyLink: (page: Page) =>
      page.getByRole('link', { name: 'Privacy Policy' }),
    termsLink: (page: Page) =>
      page.getByRole('link', { name: 'Terms of Service' }),
    signOutButton: (page: Page) =>
      page.getByRole('button', { name: 'Sign out' }),
  },
} as const;

/**
 * Wait for the mock realtime resync to settle before sending a message.
 *
 * api.mock.ts fires subscribeToUserMessages' onResync 50ms after subscribing,
 * and ChatPane's fetchInitialMessages() calls setMessages(formatted), replacing
 * any optimistic message present at that moment. Without this wait, a send can
 * be silently dropped even though it was persisted to the mock store.
 */
export async function waitForChatHistoryReady(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Message history' }).waitFor();
  // Mock latency is 200-400ms per fetch; allow the 50ms resync + fetch to finish.
  await page.waitForTimeout(700);
}

/**
 * Keep fixed app chrome (update/notification/offline banners) from covering
 * the controls under test. These are UI-state concerns, not app journeys.
 */
export function prepareAppUi(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('thread:notifications-enabled', 'false');
    localStorage.setItem('thread-install-dismissed', '1');
    for (const phase of ['before', 'during', 'after']) {
      localStorage.setItem(`thread:update-dismissed:group-chat-1:${phase}`, '1');
    }
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });
}

/**
 * Seed the mock user before the app boots. Protected routes read
 * localStorage synchronously from api.mock.ts, so addInitScript is required.
 */
export function seedSignedInUser(
  page: Page,
  { usernameSet = true }: { usernameSet?: boolean } = {}
): Promise<void> {
  return page.addInitScript((isUsernameSet) => {
    localStorage.setItem(
      'thread_current_user',
      JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        username: 'current_user',
        displayName: 'Current User',
        usernameSet: isUsernameSet,
      })
    );
  }, usernameSet);
}
