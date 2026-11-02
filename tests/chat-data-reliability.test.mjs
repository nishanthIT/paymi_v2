import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
import * as errors from '../src/features/chat/errors.ts';
import { nextChatPage, flattenChatMessages, preserveUnsentMessages } from '../src/features/chat/history.ts';
import * as cache from '../src/features/chat/cache.ts';
import { upsertThreadMessage, removeThreadMessage } from '../src/features/chat/cache.ts';
import { chatKeys } from '../src/features/chat/keys.ts';
import * as refresh from '../src/features/chat/realtime-refresh.ts';
import * as realtime from '../src/features/chat/realtime-events.ts';
import * as direct from '../src/features/chat/direct.ts';

function loadModule(file, dependencies) {
  const source = readFileSync(new URL(`../src/features/chat/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, setTimeout, clearTimeout, AbortController, URL,
    require(name) { if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); },
  });
  return module.exports;
}

function apiModule(client) {
  return loadModule('api.ts', {
    '@/features/supermarkets/scope': {}, '@/config/api': { API_CONFIG: { BASE_URL: 'https://paymi.invalid/api' } },
    '@/services/api': { __esModule: true, default: client }, '@/utils/secureStorage': {}, 'react-native': {}, './photo-send': {}, './errors': errors,
  });
}

test('chat errors retain HTTP status and distinguish access, schema and connectivity failures', async () => {
  const denied = errors.toChatError({ response: { status: 403, data: { error: 'Forbidden' } } }, 'Fallback');
  assert.equal(denied.status, 403);
  assert.equal(errors.getChatErrorState(denied).accessDenied, true);
  assert.equal(errors.retryChatQuery(0, denied), false);
  const schema = errors.toChatError({ response: { status: 503, data: { code: 'CHAT_SCHEMA_NOT_READY', message: 'Updating' } } }, 'Fallback');
  assert.equal(schema.code, 'CHAT_SCHEMA_NOT_READY');
  assert.equal(errors.getChatErrorState(schema).title, 'Chat is being updated');
  assert.equal(errors.retryChatQuery(0, schema), false);
  const network = errors.toChatError({ code: 'ERR_NETWORK' }, 'Could not load chats');
  assert.equal(errors.getChatErrorState(network).title, 'Connection interrupted');
  assert.equal(errors.retryChatQuery(1, network), true);
  assert.equal(errors.retryChatQuery(2, network), false);
  const silent = { silent: true, status: 401 };
  assert.equal(errors.toChatError(silent, 'Fallback'), silent);
});

test('API sends trimmed full-history search and stable cursor with cancellation, rejects incomplete success payloads', async () => {
  const requests = [];
  let response = { chats: [] };
  const api = apiModule({ get: async (...args) => { requests.push(args); return { data: response }; } });
  const signal = new AbortController().signal;
  await api.fetchChats('  delivery  ', signal);
  assert.equal(requests[0][1].params.search, 'delivery');
  assert.equal(requests[0][1].signal, signal);
  assert.equal(requests[0][1].timeout, 60000);
  response = { chat: { id: 'team', messages: [], pagination: { hasMore: true, nextCursor: 'v1.cursor', limit: 30 } } };
  const page = await api.fetchChatPage('team', 1, { before: 'v1.previous', search: 'invoice', signal });
  assert.equal(page.pagination.nextCursor, 'v1.cursor');
  assert.equal(requests[1][1].params.before, 'v1.previous');
  assert.equal(requests[1][1].params.search, 'invoice');
  assert.equal(requests[1][1].signal, signal);
  assert.equal(requests[1][1].timeout, 60000);
  response = { success: true };
  await assert.rejects(api.fetchChats(), error => error.code === 'CHAT_INVALID_RESPONSE');
  await assert.rejects(api.fetchChatPage('team', 1), error => error.code === 'CHAT_INVALID_RESPONSE');
  await assert.rejects(api.fetchChatUsers('employee'), error => error.code === 'CHAT_INVALID_RESPONSE');
});

test('failed receipts are observable by the recovery hook instead of falsely acknowledged', async () => {
  let offline = true;
  const api = apiModule({ post: async () => { if (offline) throw new Error('Offline'); return { data: {} }; } });
  assert.equal(await api.markMessagesRead(['one']), false);
  offline = false;
  assert.equal(await api.markMessagesRead(['one']), true);
});

const message = (id, timestamp, extra = {}) => ({ id, content: id, timestamp, ...extra });
test('cursor pages remain stable with live inserts and have a compatible legacy fallback', () => {
  const first = { messages: Array.from({ length: 31 }, (_, id) => message(String(id), `2026-10-25T10:00:${String(id).padStart(2, '0')}Z`)), pagination: { hasMore: true, nextCursor: 'v1.older', limit: 30 } };
  assert.equal(nextChatPage(first, [first], 30), 'v1.older');
  assert.equal(nextChatPage({ ...first, pagination: { hasMore: false, nextCursor: null, limit: 30 } }, [first], 30), undefined);
  assert.equal(nextChatPage({ messages: first.messages }, [first], 30), 2);
  const flattened = flattenChatMessages({ pages: [{ messages: [message('late', '2026-10-25T10:00:01Z'), message('new', '2026-10-25T10:00:03Z')] }, { messages: [message('old', '2026-10-25T10:00:00Z'), message('late', '2026-10-25T10:00:01Z')] }], pageParams: [1, 'v1.cursor'] });
  assert.deepEqual(flattened.map(value => value.id), ['new', 'late', 'old']);
});

test('refresh preserves failed text for retry; idempotent delivery replaces pending duplicates across all pages', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const failed = message('pending-client1', '2026-10-25T10:00:03Z', { clientMessageId: 'client1', failed: true });
  const older = message('old', '2026-10-25T10:00:00Z');
  const previous = { pages: [{ messages: [failed] }], pageParams: [1] };
  const refreshed = preserveUnsentMessages(previous, { pages: [{ messages: [older] }], pageParams: [1] });
  assert.deepEqual(refreshed.pages[0].messages.map(value => value.id), ['old', 'pending-client1']);
  client.setQueryData(chatKeys.thread('team'), refreshed);
  client.setQueryData(chatKeys.messageSearch('team', 'old'), { pages: [{ messages: [older] }], pageParams: [1] });
  const saved = message('server1', '2026-10-25T10:00:03Z', { clientMessageId: 'client1' });
  upsertThreadMessage(client, 'team', saved);
  upsertThreadMessage(client, 'team', saved);
  assert.deepEqual(client.getQueryData(chatKeys.thread('team')).pages[0].messages.map(value => value.id), ['old', 'server1']);
  removeThreadMessage(client, 'team', 'old');
  assert.equal(client.getQueryData(chatKeys.messageSearch('team', 'old')).pages[0].messages.length, 0);
  client.clear();
});

test('socket reconnect reauthenticates changed tokens and cannot reuse another shop transport', async () => {
  const connections = [];
  let token = 'first-token';
  let scope = { id: 'shop-a', generation: 1 };
  const module = loadModule('socket.ts', {
    'react-native': { Alert: {} }, '@/utils/authEvents': { authEvents: {} },
    '@/features/supermarkets/scope': { getSupermarketScope: () => scope },
    '@/config/api': { API_CONFIG: { BASE_URL: 'https://paymi.invalid/api' } }, '@/utils/logger': { logger: { warn() {} } },
    '@/utils/secureStorage': { secureStorage: { getToken: async () => token } },
    'socket.io-client': { io: (_url, options) => {
      const socket = new EventEmitter(); socket.auth = options.auth; socket.connected = true; socket.disconnected = false;
      socket.connect = () => { socket.connects = (socket.connects ?? 0) + 1; socket.connected = true; socket.disconnected = false; return socket; };
      socket.disconnect = () => { socket.disconnects = (socket.disconnects ?? 0) + 1; socket.connected = false; socket.disconnected = true; return socket; };
      connections.push(socket); return socket;
    } },
  });
  const first = await module.getChatSocket();
  const listener = () => {};
  first.on('message_received', listener);
  token = 'renewed-token';
  assert.equal(await module.getChatSocket(), first);
  assert.equal(first.auth.token, token);
  assert.equal(first.disconnects, 1);
  assert.equal(first.connects, 1);
  assert.equal(first.listenerCount('message_received'), 1);
  scope = { id: 'shop-b', generation: 2 };
  const second = await module.getChatSocket();
  assert.notEqual(second, first);
  assert.equal(second.auth.supermarketId, 'shop-b');
  assert.equal(first.listenerCount('message_received'), 0);
  module.disconnectChatSocket();
});

test('socket consumers preserve reconnect backoff and repeated failures log only safe diagnostics', async () => {
  const warnings = [];
  let token = 'private-session-value';
  let options;
  const client = Object.assign(new EventEmitter(), { active: true, connected: false, disconnected: true, connects: 0, disconnects: 0 });
  client.connect = () => { client.connects++; client.active = true; return client; };
  client.disconnect = () => { client.disconnects++; client.active = false; return client; };
  const module = loadModule('socket.ts', {
    'react-native': { Alert: {} }, '@/utils/authEvents': { authEvents: {} },
    '@/features/supermarkets/scope': { getSupermarketScope: () => ({ id: 'shop-one', generation: 1 }) },
    '@/config/api': { API_CONFIG: { BASE_URL: 'http://192.0.2.1:3000/api', ENVIRONMENT: 'LOCAL' } },
    '@/utils/logger': { logger: { warn: (...args) => warnings.push(args) } },
    '@/utils/secureStorage': { secureStorage: { getToken: async () => token } },
    'socket.io-client': { io: (_url, supplied) => { options = supplied; client.auth = supplied.auth; return client; } },
  });
  try {
    assert.equal(await module.getChatSocket(), client);
    for (let i = 0; i < 10; i++) await module.getChatSocket();
    assert.equal(client.connects, 0, 'mounted consumers must not bypass active reconnect backoff');
    assert.ok(options.reconnectionDelayMax > options.reconnectionDelay);
    const failure = Object.assign(new Error('xhr poll error'), {
      description: 0, context: { status: 0, responseText: 'private-server-payload', headers: { Authorization: token } },
    });
    for (let i = 0; i < 30; i++) client.emit('connect_error', failure);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][1].endpoint, 'http://192.0.2.1:3000');
    assert.equal(warnings[0][1].httpStatus, 0);
    assert.equal(warnings[0][1].retrying, true);
    client.emit('connect_error', Object.assign(new Error('xhr poll error'), { description: 403 }));
    assert.equal(warnings.length, 2, 'a new failure status should be visible immediately');
    assert.equal(warnings[1][1].httpStatus, 403);
    client.emit('connect');
    client.emit('connect_error', failure);
    assert.equal(warnings.length, 3, 'a later outage should be logged after recovery');
    const logged = JSON.stringify(warnings);
    assert.equal(logged.includes(token), false);
    assert.equal(logged.includes('private-server-payload'), false);

    token = 'renewed-private-session';
    await module.getChatSocket();
    assert.equal(client.disconnects, 1, 'changing credentials must cancel even an in-progress handshake');
    assert.equal(client.connects, 1);
    assert.equal(client.auth.token, token);
  } finally { module.disconnectChatSocket(); }
});

test('replayed socket messages cannot inflate unread badges; search caches expire on new content', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const socket = new EventEmitter(); const cleanups = [];
  client.setQueryData(chatKeys.all, [{ id: 'team', unreadCount: 0 }]);
  client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [] }], pageParams: [1] });
  client.setQueryData(chatKeys.search('invoice'), []);
  client.setQueryData(chatKeys.messageSearch('team', 'invoice'), { pages: [{ messages: [] }], pageParams: [1] });
  const hooks = loadModule('hooks/use-chats.ts', {
    '@tanstack/react-query': { useQueryClient: () => client },
    react: { useEffect(effect) { cleanups.push(effect()); } },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/contexts/AuthContext': { useAuth: () => ({ isAuthenticated: true, user: { id: 1, userType: 'EMPLOYEE' }, activeSupermarket: { id: 'shop' } }) },
    'expo-router': { useRouter: () => ({}) }, 'expo-haptics': {}, '@/components/ui/toast': { useToast: () => ({ showToast() {} }) },
    '@/features/supermarkets/scope': {}, '../direct': direct, '../realtime-events': realtime,
    '@/hooks/use-debounced-value': {}, '../api': {}, '../cache': cache, '../keys': { chatKeys }, '../errors': errors,
    '../realtime-refresh': refresh, '../socket': { getChatSocket: async () => socket },
  });
  hooks.useChatRealtime();
  await new Promise(resolve => setImmediate(resolve));
  const incoming = { id: 'new-message', chatId: 'team', senderId: 2, senderType: 'EMPLOYEE', content: 'invoice', messageType: 'TEXT', timestamp: '2026-10-25T10:00:00Z' };
  socket.emit('message_received', incoming); socket.emit('message_received', incoming);
  assert.equal(client.getQueryData(chatKeys.all)[0].unreadCount, 1);
  assert.equal(client.getQueryData(chatKeys.thread('team')).pages[0].messages.length, 1);
  assert.equal(client.getQueryState(chatKeys.search('invoice')).isInvalidated, true);
  assert.equal(client.getQueryState(chatKeys.messageSearch('team', 'invoice')).isInvalidated, true);
  cleanups.forEach(cleanup => cleanup?.()); client.clear();
});

test('a shop directory denial clears cached searches and contacts, while a network error preserves them', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const keys = [chatKeys.all, chatKeys.search('old message'), chatKeys.users('employee')];
  try {
    for (const key of keys) client.setQueryData(key, [{ id: 'private' }]);
    client.setQueryData(chatKeys.thread('team'), { pages: [{ messages: [{ id: 'private-message' }] }], pageParams: [1] });
    client.setQueryData(chatKeys.messageSearch('team', 'old'), { pages: [{ messages: [{ id: 'private-message' }] }], pageParams: [1] });
    cache.clearDeniedChatDirectory(client, errors.toChatError({ code: 'ERR_NETWORK' }, 'Offline'));
    assert.equal(client.getQueryData(chatKeys.all).length, 1);
    cache.clearDeniedChatDirectory(client, Object.assign(new Error('Forbidden'), { status: 403 }));
    await Promise.resolve();
    for (const key of keys) assert.deepEqual(client.getQueryData(key), []);
    assert.equal(client.getQueryData(chatKeys.thread('team')), undefined);
    assert.equal(client.getQueryData(chatKeys.messageSearch('team', 'old')), undefined);
  } finally { client.clear(); }
});
