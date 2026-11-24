import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient, createAuthenticatedClient } from './helpers';
import {
  searchUserByUsername,
  getOrCreateDirectConversation,
  sendMessage,
  loadMessages,
  blockUser,
  unblockUser,
  subscribeToUserMessages,
  newClientId,
  createGroup,
  listGroupMembers,
} from '../../src/lib/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

describe('Real Stack Integration Tests (Real JWTs)', { timeout: 40000 }, () => {
  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;
  let clientC: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;
  let userCId: string;

  let usernameA: string;
  let usernameB: string;

  beforeAll(async () => {
    const rootClient = createTestClient();
    const timestamp = Date.now();

    usernameA = `user_a_${timestamp.toString(36)}`;
    usernameB = `user_b_${timestamp.toString(36)}`;
    const usernameC = `user_c_${timestamp.toString(36)}`;

    // 1. Sign up User A
    const { data: authA, error: errA } = await rootClient.auth.signUp({
      email: `${usernameA}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: usernameA, display_name: 'User A' } },
    });
    if (errA || !authA.user || !authA.session) {
      throw new Error(`Failed to sign up User A: ${errA?.message}`);
    }
    userAId = authA.user.id;
    clientA = await createAuthenticatedClient(authA.session);

    // 2. Sign up User B
    const { data: authB, error: errB } = await rootClient.auth.signUp({
      email: `${usernameB}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: usernameB, display_name: 'User B' } },
    });
    if (errB || !authB.user || !authB.session) {
      throw new Error(`Failed to sign up User B: ${errB?.message}`);
    }
    userBId = authB.user.id;
    clientB = await createAuthenticatedClient(authB.session);

    // 3. Sign up User C (Stranger)
    const { data: authC, error: errC } = await rootClient.auth.signUp({
      email: `${usernameC}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: usernameC, display_name: 'User C' } },
    });
    if (errC || !authC.user || !authC.session) {
      throw new Error(`Failed to sign up User C: ${errC?.message}`);
    }
    userCId = authC.user.id;
    clientC = await createAuthenticatedClient(authC.session);
  });

  it('search finds exact username only and ignores partial/wildcards', async () => {
    const exactResult = await searchUserByUsername(usernameB, clientA);
    expect(exactResult.error).toBeNull();
    expect(exactResult.data).not.toBeNull();
    expect(exactResult.data?.id).toBe(userBId);
    expect(exactResult.data?.username).toBe(usernameB);

    const partialResult = await searchUserByUsername(usernameB.substring(0, 4), clientA);
    expect(partialResult.error).toBeNull();
    expect(partialResult.data).toBeNull();

    const wildcardResult = await searchUserByUsername(`${usernameB}%`, clientA);
    expect(wildcardResult.error).toBeNull();
    expect(wildcardResult.data).toBeNull();
  });

  it('getOrCreateDirectConversation returns the same id from both sides', async () => {
    const resA = await getOrCreateDirectConversation(userBId, clientA);
    expect(resA.error).toBeNull();
    expect(resA.data).toBeTruthy();

    const resB = await getOrCreateDirectConversation(userAId, clientB);
    expect(resB.error).toBeNull();
    expect(resB.data).toBe(resA.data);
  });

  it('sendMessage works and a retry with the same clientId returns the original message', async () => {
    const convRes = await getOrCreateDirectConversation(userBId, clientA);
    const conversationId = convRes.data!;

    const clientId = newClientId();

    const send1 = await sendMessage(
      { conversationId, body: 'Original message text', clientId },
      clientA
    );
    expect(send1.error).toBeNull();
    expect(send1.data?.body).toBe('Original message text');
    expect(send1.data?.clientId).toBe(clientId);

    const send2 = await sendMessage(
      { conversationId, body: 'Different retry text', clientId },
      clientA
    );
    expect(send2.error).toBeNull();
    expect(send2.data?.id).toBe(send1.data?.id);
    expect(send2.data?.body).toBe('Original message text');
  });

  it('user C cannot read conversation AB', async () => {
    const convRes = await getOrCreateDirectConversation(userBId, clientA);
    const conversationId = convRes.data!;

    const resC = await loadMessages({ conversationId }, clientC);
    expect(resC.error).toBeNull();
    expect(resC.data?.messages).toHaveLength(0);
  });

  it('a blocked sender gets generic OPERATION_FAILED', async () => {
    const convRes = await getOrCreateDirectConversation(userBId, clientA);
    const conversationId = convRes.data!;

    const blockRes = await blockUser(userAId, clientB);
    expect(blockRes.error).toBeNull();

    const sendRes = await sendMessage(
      { conversationId, body: 'Blocked message attempt', clientId: newClientId() },
      clientA
    );
    expect(sendRes.data).toBeNull();
    expect(sendRes.error?.code).toBe('OPERATION_FAILED');

    const unblockRes = await unblockUser(userAId, clientB);
    expect(unblockRes.error).toBeNull();
  });

  it('direct insert into messages is denied for authenticated user', async () => {
    const convRes = await getOrCreateDirectConversation(userBId, clientA);
    const conversationId = convRes.data!;

    const { error } = await clientA.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userAId,
      client_id: newClientId(),
      body: 'Direct insert attempt',
    });

    expect(error).not.toBeNull();
  });

  it('the 61st message in 60s is rejected with RATE_LIMITED', async () => {
    const convRes = await getOrCreateDirectConversation(userBId, clientA);
    const conversationId = convRes.data!;

    let hitRateLimit = false;
    for (let i = 0; i < 65; i++) {
      const res = await sendMessage(
        { conversationId, body: `Flood test message ${i}`, clientId: newClientId() },
        clientA
      );
      if (res.error?.code === 'RATE_LIMITED') {
        hitRateLimit = true;
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
  });

  it('REALTIME: subscriber receives message within 5s and receives nothing from stranger conversation', async () => {
    const rootClient = createTestClient();
    const ts = Date.now();

    // Create User D and User E with clean rate-limit state
    const { data: authD } = await rootClient.auth.signUp({
      email: `user_d_${ts}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: `user_d_${ts.toString(36)}` } },
    });
    const clientD = await createAuthenticatedClient(authD!.session!);

    const { data: authE } = await rootClient.auth.signUp({
      email: `user_e_${ts}@integration.test`,
      password: 'TestPassword123!',
      options: { data: { username: `user_e_${ts.toString(36)}` } },
    });
    const clientE = await createAuthenticatedClient(authE!.session!);

    const convDERes = await getOrCreateDirectConversation(authE!.user!.id, clientD);
    const convDEId = convDERes.data!;

    // Also create separate conversation between User D and User C
    const convDCRes = await getOrCreateDirectConversation(userCId, clientD);
    const convDCId = convDCRes.data!;

    const receivedMessages: string[] = [];

    // Promise that resolves once channel is actively SUBSCRIBED
    let onSubscribedResolve: () => void;
    const subscribedPromise = new Promise<void>((resolve) => {
      onSubscribedResolve = resolve;
    });

    // User E subscribes to real-time messages
    const unsubscribe = subscribeToUserMessages(
      authE!.user!.id,
      (msg) => {
        receivedMessages.push(msg.body);
      },
      () => {
        onSubscribedResolve();
      },
      clientE
    );

    // Wait until Realtime channel is confirmed SUBSCRIBED
    await subscribedPromise;

    // User D sends a message to stranger conversation DC (User E should NOT receive it)
    await sendMessage(
      { conversationId: convDCId, body: 'Secret message for User C', clientId: newClientId() },
      clientD
    );

    // User D sends a message to conversation DE (User E MUST receive it)
    await sendMessage(
      { conversationId: convDEId, body: 'Hello User E Realtime!', clientId: newClientId() },
      clientD
    );

    // Wait up to 5s for delivery
    const start = Date.now();
    while (receivedMessages.length === 0 && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    unsubscribe();

    expect(receivedMessages).toContain('Hello User E Realtime!');
    expect(receivedMessages).not.toContain('Secret message for User C');
  });

  it('group create/send/receive works for members', async () => {
    const createRes = await createGroup(`Group ${Date.now()}`, [usernameB], clientA);
    expect(createRes.error).toBeNull();
    const conversationId = createRes.data!;
    expect(conversationId).toBeTruthy();

    const membersRes = await listGroupMembers(conversationId, clientA);
    expect(membersRes.error).toBeNull();
    expect(membersRes.data?.length).toBe(2);

    const sendRes = await sendMessage(
      { conversationId, body: 'Group hello', clientId: newClientId() },
      clientB
    );
    expect(sendRes.error).toBeNull();

    const loadRes = await loadMessages({ conversationId, limit: 10 }, clientA);
    expect(loadRes.error).toBeNull();
    expect(loadRes.data?.messages.some((m) => m.body === 'Group hello')).toBe(true);
  });
});
