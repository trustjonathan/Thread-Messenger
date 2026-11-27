import type { ConversationSummary, CurrentUser, Message } from '@/types/api';

const DATABASE_NAME = 'thread-messenger-offline';
const DATABASE_VERSION = 1;
const MAX_CACHED_MESSAGES_PER_CONVERSATION = 300;
const STORE_NAMES = ['profiles', 'conversations', 'messages', 'outbox'] as const;
type StoreName = (typeof STORE_NAMES)[number];

interface StoredValue<T> {
  key: string;
  userId: string;
  value: T;
}

interface OutboxRecord {
  key: string;
  userId: string;
  message: Message;
}

type StoreMap = Record<StoreName, IDBObjectStore>;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        for (const name of STORE_NAMES) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, { keyPath: 'key' });
          }
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };

      request.onerror = () => {
        databasePromise = null;
        reject(request.error || new Error('Unable to open local chat storage.'));
      };

      request.onblocked = () => {
        databasePromise = null;
        reject(new Error('Local chat storage is blocked by another open tab.'));
      };
    });
  }

  return databasePromise;
}

async function transact<T>(
  names: StoreName[],
  mode: IDBTransactionMode,
  run: (stores: StoreMap, setResult: (value: T) => void) => void
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(names, mode);
    const stores = {} as StoreMap;
    for (const name of names) {
      stores[name] = transaction.objectStore(name);
    }

    let result: T;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Local chat storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Local chat storage transaction was aborted.'));

    try {
      run(stores, (value) => {
        result = value;
      });
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function messageKey(userId: string, message: Message): string {
  return `${userId}:${message.conversationId}:${message.clientId || message.id}`;
}

function conversationKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

function compareNewestFirst(a: Message, b: Message): number {
  const timeDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return timeDifference || b.id.localeCompare(a.id);
}

function updateConversationPreview(
  stores: StoreMap,
  userId: string,
  message: Message
): void {
  const request = stores.conversations.getAll();
  request.onsuccess = () => {
    const record = (request.result as StoredValue<ConversationSummary>[])
      .find((item) => item.key === conversationKey(userId, message.conversationId));
    if (!record) return;

    const previous = record.value.lastMessage;
    if (previous && Date.parse(previous.createdAt) > Date.parse(message.createdAt)) return;

    stores.conversations.put({
      ...record,
      value: {
        ...record.value,
        lastMessage: {
          id: message.id,
          body: message.body.slice(0, 100),
          senderId: message.senderId,
          createdAt: message.createdAt,
        },
      },
    });
  };
}

export async function cacheProfile(profile: CurrentUser): Promise<void> {
  await transact(['profiles'], 'readwrite', (stores) => {
    stores.profiles.put({ key: profile.id, userId: profile.id, value: profile });
  });
}

export async function getCachedProfile(userId: string): Promise<CurrentUser | null> {
  return transact(['profiles'], 'readonly', (stores, setResult) => {
    const request = stores.profiles.get(userId);
    request.onsuccess = () => setResult((request.result as StoredValue<CurrentUser> | undefined)?.value ?? null);
  });
}

export async function cacheConversations(
  userId: string,
  conversations: ConversationSummary[]
): Promise<void> {
  await transact(['conversations'], 'readwrite', (stores) => {
    for (const conversation of conversations) {
      stores.conversations.put({
        key: conversationKey(userId, conversation.conversationId),
        userId,
        value: conversation,
      });
    }
  });
}

export async function getCachedConversations(userId: string): Promise<ConversationSummary[]> {
  return transact(['conversations'], 'readonly', (stores, setResult) => {
    const request = stores.conversations.getAll();
    request.onsuccess = () => {
      setResult(
        (request.result as StoredValue<ConversationSummary>[])
          .filter((record) => record.userId === userId)
          .map((record) => record.value)
          .sort((a, b) => {
            const aTime = a.lastMessage?.createdAt || a.createdAt;
            const bTime = b.lastMessage?.createdAt || b.createdAt;
            return Date.parse(bTime) - Date.parse(aTime);
          })
      );
    };
  });
}

export async function cacheMessages(userId: string, messages: Message[]): Promise<void> {
  if (messages.length === 0) return;

  await transact(['messages', 'conversations'], 'readwrite', (stores) => {
    const request = stores.messages.getAll();
    request.onsuccess = () => {
      const allRecords = request.result as StoredValue<Message>[];
      for (const message of messages) {
        stores.messages.put({
          key: messageKey(userId, message),
          userId,
          value: message,
        });
        updateConversationPreview(stores, userId, message);
      }

      const recordsForConversation = new Map<string, StoredValue<Message>>();
      for (const record of allRecords) {
        if (
          record.userId === userId &&
          record.value.conversationId === messages[0].conversationId
        ) {
          recordsForConversation.set(record.key, record);
        }
      }
      for (const message of messages) {
        const key = messageKey(userId, message);
        recordsForConversation.set(key, {
          key,
          userId,
          value: message,
        });
      }

      const removable = [...recordsForConversation.values()]
        .filter((record) => record.value.deliveryStatus !== 'queued')
        .sort((a, b) => compareNewestFirst(a.value, b.value))
        .slice(MAX_CACHED_MESSAGES_PER_CONVERSATION);
      for (const record of removable) {
        stores.messages.delete(record.key);
      }
    };
  });
}

export async function getCachedMessages(
  userId: string,
  conversationId: string,
  cursor: { createdAt: string; id: string } | undefined,
  limit: number
): Promise<{ messages: Message[]; nextCursor: { createdAt: string; id: string } | null; hasMore: boolean }> {
  return transact(['messages'], 'readonly', (stores, setResult) => {
    const request = stores.messages.getAll();
    request.onsuccess = () => {
      const messages = (request.result as StoredValue<Message>[])
        .filter((record) =>
          record.userId === userId && record.value.conversationId === conversationId
        )
        .map((record) => record.value)
        .sort(compareNewestFirst)
        .filter((message) => {
          if (!cursor) return true;
          return message.createdAt < cursor.createdAt ||
            (message.createdAt === cursor.createdAt && message.id < cursor.id);
        });
      const hasMore = messages.length > limit;
      const page = messages.slice(0, limit);
      const last = page[page.length - 1];
      setResult({
        messages: page,
        nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
        hasMore,
      });
    };
  });
}

export async function queueMessage(userId: string, message: Message): Promise<Message> {
  const queuedMessage: Message = {
    ...message,
    id: `offline:${message.clientId}`,
    deliveryStatus: 'queued',
  };

  await transact(['messages', 'outbox', 'conversations'], 'readwrite', (stores) => {
    stores.messages.put({
      key: messageKey(userId, queuedMessage),
      userId,
      value: queuedMessage,
    });
    stores.outbox.put({
      key: `${userId}:${queuedMessage.clientId}`,
      userId,
      message: queuedMessage,
    });
    updateConversationPreview(stores, userId, queuedMessage);
  });

  return queuedMessage;
}

export async function getQueuedMessages(userId: string): Promise<Message[]> {
  return transact(['outbox'], 'readonly', (stores, setResult) => {
    const request = stores.outbox.getAll();
    request.onsuccess = () => {
      setResult(
        (request.result as OutboxRecord[])
          .filter((record) => record.userId === userId)
          .map((record) => record.message)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      );
    };
  });
}

export async function completeQueuedMessage(
  userId: string,
  clientId: string,
  message: Message
): Promise<void> {
  await transact(['messages', 'outbox', 'conversations'], 'readwrite', (stores) => {
    stores.messages.put({
      key: messageKey(userId, message),
      userId,
      value: message,
    });
    stores.outbox.delete(`${userId}:${clientId}`);
    updateConversationPreview(stores, userId, message);
  });
}

export async function failQueuedMessage(
  userId: string,
  clientId: string,
  message: Message
): Promise<void> {
  await transact(['messages', 'outbox'], 'readwrite', (stores) => {
    stores.messages.put({
      key: messageKey(userId, message),
      userId,
      value: { ...message, deliveryStatus: 'failed' },
    });
    stores.outbox.delete(`${userId}:${clientId}`);
  });
}
