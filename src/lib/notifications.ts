export type NotificationPermission = 'granted' | 'denied' | 'default';

const NOTIFICATIONS_ENABLED_KEY = 'thread:notifications-enabled';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function getNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (stored === null) return true; // default on
    return stored === 'true';
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (!isNotificationSupported()) return;
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return Promise.resolve('denied');
  }
  return window.Notification.requestPermission() as Promise<NotificationPermission>;
}

export interface IncomingMessageNotification {
  conversationId: string;
  title: string;
  body: string;
}

export function showIncomingMessageNotification({
  conversationId,
  title,
  body,
}: IncomingMessageNotification): void {
  if (!isNotificationSupported()) return;
  if (!getNotificationsEnabled()) return;
  if (window.Notification.permission !== 'granted') return;

  const notification = new window.Notification(title, {
    body,
    tag: conversationId,
    icon: '/favicon.ico',
    data: { conversationId },
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
