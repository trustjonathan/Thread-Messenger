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
      page.getByRole('heading', { name: 'Simple text messaging.', level: 1 }),
    subtitle: (page: Page) => page.getByText('Find friends by username.'),
    bulletTextOnly: (page: Page) =>
      page.getByText('Text only — no images, no noise.'),
    bulletExactUsername: (page: Page) =>
      page.getByText('Find people by exact username, nothing more.'),
    bulletFreeForever: (page: Page) =>
      page.getByText('Free to use, forever.'),
    getStartedButton: (page: Page) =>
      page.getByRole('link', { name: 'Get started' }),
    unencryptedDisclosure: (page: Page) =>
      page.getByText('Messages are stored on our servers and are not end-to-end encrypted.'),
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
      page.getByPlaceholder('e.g. alex_99'),
    claimButton: (page: Page) =>
      page.getByRole('button', { name: 'Claim username' }),
    errorAlert: (page: Page) =>
      page.getByRole('alert'),
  },

  chatList: {
    heading: (page: Page) =>
      page.getByRole('heading', { name: 'Chats', level: 1 }),
    newChatButton: (page: Page) =>
      page.getByRole('link', { name: 'New chat' }),
    refreshButton: (page: Page) =>
      page.getByRole('button', { name: 'Refresh conversations' }),
    copyUsernameButton: (page: Page) =>
      page.getByRole('button', { name: 'Copy your username' }),
    conversationItem: (page: Page, namePattern: string | RegExp) =>
      page.getByRole('button', { name: namePattern }),
  },

  chat: {
    backButton: (page: Page) =>
      page.getByRole('link', { name: 'Back to chats' }),
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
    messageInput: (page: Page) =>
      page.getByRole('textbox', { name: 'Message' }),
    sendButton: (page: Page) =>
      page.getByRole('button', { name: 'Send message' }),
    sendingIndicator: (page: Page) =>
      page.getByText('· sending...'),
    sentIndicator: (page: Page) =>
      page.getByText('· sent'),
    rateLimitError: (page: Page) =>
      page.getByText("You're sending too fast. Try again in a minute."),
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
