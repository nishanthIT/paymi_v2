import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import * as cacheHelpers from '../src/features/chat/cache.ts';
import { chatKeys } from '../src/features/chat/keys.ts';
import * as historyHelpers from '../src/features/chat/history.ts';
import * as chatErrors from '../src/features/chat/errors.ts';
import * as realtime from '../src/features/chat/realtime-events.ts';

// Capture the hook's actual options, then execute them with TanStack's real mutation
// lifecycle. Only the network/native bindings and signed-in identity are substituted.
function threadHooks(client, api, focused = true, runtime = {}) {
  const source = readFileSync(new URL('../src/features/chat/hooks/use-chat-thread.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports, setTimeout: runtime.setTimeout ?? setTimeout, clearTimeout: runtime.clearTimeout ?? clearTimeout,
    require(name) {
      if (name === '@tanstack/react-query') return { useQueryClient: () => client, useMutation: options => options };
      if (name === '@/contexts/AuthContext') return { useAuth: () => ({ user: { id: 7, name: 'Employee', userType: 'EMPLOYEE' } }) };
      if (name === '../api') return api;
      if (name === '../cache') return cacheHelpers;
      if (name === '../keys') return { chatKeys };
      if (name === '../history') return historyHelpers;
      if (name === '../errors') return chatErrors;
      if (name === '@/hooks/use-debounced-value') return { useDebouncedValue: value => value };
      if (name === 'react') return runtime.react ?? { useEffect: effect => effect(), useRef: current => ({ current }), useState: initial => [initial, () => {}] };
      if (name === 'expo-router') return { useIsFocused: () => focused };
      if (name === '../realtime-events') return realtime;
      if (name === '../socket') return { getChatSocket: async () => null };
      if (name === 'react-native') return { AppState: { currentState: runtime.appState ?? 'active', addEventListener: () => ({ remove() {} }) } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return module.exports;
}

const sendOptions = (client, sendChatMessage, retainFailedMessage) => threadHooks(client, { sendChatMessage }).useSendMessage('team', { retainFailedMessage });

test('offline photo sends fail promptly and restore the thread so the preview remains retryable', { timeout: 2000 }, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { networkMode: 'online', retry: false } } });
  const previousOnline = onlineManager.isOnline();
  onlineManager.setOnline(false);
  client.setQueryData(chatKeys.all, [{ id: 'team', lastMessage: 'Earlier', unreadCount: 0 }]);
  client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [{ id: 'earlier', content: 'Earlier' }] }], pageParams: [1] });
  let calls = 0;
  const options = sendOptions(client, async () => { calls += 1; throw new Error('Network unavailable'); }, false);
  const mutation = client.getMutationCache().build(client, options);
  try {
    await assert.rejects(mutation.execute({ content: 'Photo', messageType: 'IMAGE', attachmentUrl: '/uploads/chat/photo.jpg' }), /Network unavailable/);
    assert.equal(calls, 1);
    assert.equal(mutation.state.isPaused, false);
    assert.deepEqual(client.getQueryData(chatKeys.thread('team')).pages[0].messages.map(m => m.id), ['earlier']);
    assert.equal(client.getQueryState(chatKeys.all).isInvalidated, true);
  } finally {
    onlineManager.setOnline(previousOnline);
    client.clear();
  }
});

test('ordinary failed messages retain their failed bubble for the existing retry controls', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [] }], pageParams: [1] });
  const mutation = client.getMutationCache().build(client, sendOptions(client, async () => { throw new Error('Send failed'); }, true));
  try {
    await assert.rejects(mutation.execute({ content: 'Hello' }), /Send failed/);
    const [message] = client.getQueryData(chatKeys.thread('team')).pages[0].messages;
    assert.equal(message.failed, true);
    assert.equal(message.pending, false);
    assert.equal(message.senderType, 'EMPLOYEE');
    assert.equal(message.content, 'Hello');
  } finally { client.clear(); }
});

test('a background thread never marks messages read, and a colliding owner ID is not the employee read receipt', async () => {
  const client = new QueryClient();
  const marked = [];
  const api = { markMessagesRead: async ids => { marked.push(...ids); } };
  const messages = [
    { id: 'owner-read', isOwnMessage: false, readBy: [{ userId: 7, userType: 'CUSTOMER' }] },
    { id: 'employee-read', isOwnMessage: false, readBy: [{ userId: 7, userType: 'EMPLOYEE' }] },
    { id: 'own-message', isOwnMessage: true },
  ];
  threadHooks(client, api, false).useThreadRealtime('team', messages);
  await Promise.resolve();
  assert.deepEqual(marked, []);
  threadHooks(client, api, true).useThreadRealtime('team', messages);
  await Promise.resolve();
  assert.deepEqual(marked, ['owner-read']);
  client.clear();
});

test('successful photo replay replaces the temporary bubble and refreshes optimistic conversation activity', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const stored = { id: 'saved-photo', content: 'Photo', messageType: 'IMAGE', timestamp: '2026-10-20T10:00:00Z', isOwnMessage: true };
  client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [stored] }], pageParams: [1] });
  client.setQueryData(chatKeys.all, [{ id: 'team', lastMessage: 'Newer text', lastMessageTime: '2026-10-21T10:00:00Z' }]);
  try {
    const mutation = client.getMutationCache().build(client, sendOptions(client, async () => stored, false));
    await mutation.execute({ content: 'Photo', messageType: 'IMAGE', clientMessageId: '/uploads/chat/photo.jpg' });
    assert.deepEqual(client.getQueryData(chatKeys.thread('team')).pages[0].messages.map(m => m.id), ['saved-photo']);
    assert.equal(client.getQueryState(chatKeys.all).isInvalidated, true);
  } finally { client.clear(); }
});

test('a failed text retry preserves its idempotency key after the server acknowledgement was lost', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [] }], pageParams: [1] });
  const inputs = [];
  const send = async input => {
    inputs.push({ ...input });
    if (inputs.length === 1) throw new Error('Acknowledgement lost');
    return { id: 'saved-on-first-attempt', content: input.content, clientMessageId: input.clientMessageId, timestamp: '2026-10-25T10:00:00Z' };
  };
  try {
    await assert.rejects(client.getMutationCache().build(client, sendOptions(client, send, true)).execute({ content: 'Once only' }));
    const failed = client.getQueryData(chatKeys.thread('team')).pages[0].messages[0];
    assert.ok(failed.clientMessageId);
    await client.getMutationCache().build(client, sendOptions(client, send, true)).execute({ content: failed.content, clientMessageId: failed.clientMessageId });
    assert.equal(inputs[0].clientMessageId, inputs[1].clientMessageId);
    assert.deepEqual(client.getQueryData(chatKeys.thread('team')).pages[0].messages.map(message => message.id), ['saved-on-first-attempt']);
  } finally { client.clear(); }
});

test('read receipt failures keep unread counts and retry after network recovery', async () => {
  const client = new QueryClient();
  client.setQueryData(chatKeys.all, [{ id: 'team', unreadCount: 5 }]);
  const refs = []; let refIndex = 0; let attempt = 0; const timers = []; const cleanups = [];
  const runtime = {
    setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
    react: {
      useEffect(effect) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
      useRef(current) { const index = refIndex++; return refs[index] ??= { current }; },
      useState(initial) { return [typeof initial === 'number' ? attempt : initial, update => { if (typeof update === 'function') attempt = update(attempt); }]; },
    },
  };
  let online = false; let calls = 0;
  const hooks = threadHooks(client, { markMessagesRead: async () => { calls++; return online; } }, true, runtime);
  const messages = [{ id: 'unread', isOwnMessage: false, readBy: [] }];
  hooks.useThreadRealtime('team', messages);
  await Promise.resolve();
  assert.equal(client.getQueryData(chatKeys.all)[0].unreadCount, 5);
  assert.equal(client.getQueryState(chatKeys.all).isInvalidated, false);
  assert.equal(timers.length, 1);
  online = true; timers[0]();
  cleanups.splice(0).forEach(cleanup => cleanup()); refIndex = 0;
  hooks.useThreadRealtime('team', messages);
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(client.getQueryState(chatKeys.all).isInvalidated, true);
  // Unloaded older unread messages must not be blindly set to zero.
  assert.equal(client.getQueryData(chatKeys.all)[0].unreadCount, 5);
  cleanups.forEach(cleanup => cleanup()); client.clear();
});

test('an app left in the background does not mark a still-focused thread read', async () => {
  const client = new QueryClient(); let reads = 0;
  const hooks = threadHooks(client, { markMessagesRead: async () => { reads++; return true; } }, true, { appState: 'background' });
  hooks.useThreadRealtime('team', [{ id: 'incoming', isOwnMessage: false, readBy: [] }]);
  await Promise.resolve();
  assert.equal(reads, 0);
  client.clear();
});
