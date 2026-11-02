import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
import { findDirectChat, resolveDirectChat } from '../src/features/chat/direct.ts';
import { chatKeys } from '../src/features/chat/keys.ts';
import { applyMessageReceipt, upsertThreadMessage } from '../src/features/chat/cache.ts';
import { focusChat, subscribeChatMessages } from '../src/features/chat/realtime-events.ts';
import { subscribeChatRefresh } from '../src/features/chat/realtime-refresh.ts';
import { getChatErrorState } from '../src/features/chat/errors.ts';
import { ChatColors, chatInitials } from '../src/features/chat/theme.ts';

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const actor = { userId: 1, userType: 'CUSTOMER' }, recipient = { userId: 1, userType: 'EMPLOYEE' };
const scope = { id: 'shop-a', generation: 1 };
const people = [actor, recipient].map(person => ({ id: person.userId, userType: person.userType, name: person.userType }));
const summary = extra => ({ id: 'direct', type: 'PERSONAL', shopId: null, isCommunityChat: true, participants: people, otherParticipants: [people[1]], unreadCount: 0, name: 'Employee', ...extra });
const message = (id, extra = {}) => ({ id, chatId: 'direct', senderId: 1, senderType: 'EMPLOYEE', senderName: 'Alex', isOwnMessage: false, content: id, messageType: 'TEXT', timestamp: new Date().toISOString(), ...extra });
const thread = messages => ({ pages: [{ id: 'direct', messages }], pageParams: [1] });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Outbound Socket.IO emits do not recursively invoke the client's inbound listeners.
class Socket extends EventEmitter {
  sent = [];
  emit(event, payload) { this.sent.push({ event, payload }); return true; }
  receive(event, payload) { return super.emit(event, payload); }
}

test('cached DM reuse requires the exact typed pair and authorized scope; groups and duplicate participants never match', async () => {
  const cached = summary();
  assert.equal(findDirectChat([cached], actor, recipient, scope.id), cached);
  assert.equal(findDirectChat([summary({ isCommunityChat: false, shopId: 'other' })], actor, recipient, scope.id), undefined);
  assert.equal(findDirectChat([summary({ type: 'GROUP' })], actor, recipient, scope.id), undefined);
  assert.equal(findDirectChat([summary({ participants: [people[0], people[0]] })], actor, recipient, scope.id), undefined);
  assert.equal(findDirectChat([cached], actor, actor, scope.id), undefined);
  const cache = client(); cache.setQueryData(chatKeys.all, [cached]);
  try {
    const result = await resolveDirectChat({ queryClient: cache, actor, recipient, scope, isCurrent: () => true, create: () => { throw new Error('Must reuse cached room'); } });
    assert.equal(result.id, 'direct');
  } finally { cache.clear(); }
});

test('concurrent DM opening shares one request and primes a new room immediately without awaiting refresh', async () => {
  const cache = client(), request = deferred(); let creates = 0;
  const options = { queryClient: cache, actor, recipient, scope, isCurrent: () => true, create: () => { creates++; return request.promise; } };
  try {
    const first = resolveDirectChat(options), second = resolveDirectChat(options);
    assert.equal(first, second);
    await tick(); assert.equal(creates, 1);
    request.resolve(summary({ initialPage: { id: 'direct', name: 'Employee', type: 'PERSONAL', participants: people, messages: [], pagination: { hasMore: false, nextCursor: null, limit: 30 } } }));
    await first;
    assert.equal(cache.getQueryData(chatKeys.all).length, 1);
    assert.equal(cache.getQueryData(chatKeys.all)[0].initialPage, undefined);
    assert.deepEqual(cache.getQueryData(chatKeys.thread('direct')).pages[0].messages, []);
    assert.equal(cache.getQueryState(chatKeys.all).isInvalidated, true);
  } finally { cache.clear(); }
});

test('failed room creation is retryable, while a late response after shop change cannot populate the next account cache', async () => {
  const cache = client(); let current = true, calls = 0;
  const options = { queryClient: cache, actor, recipient, scope, isCurrent: () => current, create: async () => { if (++calls === 1) throw new Error('Offline'); return summary(); } };
  try {
    await assert.rejects(resolveDirectChat(options), /Offline/);
    current = false;
    await assert.rejects(resolveDirectChat(options), /changed/);
    assert.equal(cache.getQueryData(chatKeys.all), undefined);
    current = true; await resolveDirectChat(options);
    assert.equal(calls, 3); assert.equal(cache.getQueryData(chatKeys.all).length, 1);
  } finally { cache.clear(); }
});

test('unopened incoming DMs update unread and notify once; loaded replays, own messages, and inactive app stay silent', () => {
  const cache = client(), socket = new Socket(), notifications = [];
  let foreground = true;
  cache.setQueryData(chatKeys.all, [summary()]); cache.setQueryData(chatKeys.thread('direct'), thread([]));
  const cleanup = subscribeChatMessages(socket, cache, { actor, isForeground: () => foreground, notify: event => notifications.push(event.id) });
  try {
    const first = message('one'); socket.receive('message_received', first); socket.receive('message_received', first);
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 1);
    assert.deepEqual(notifications, ['one']);
    assert.equal(cache.getQueryData(chatKeys.thread('direct')).pages[0].messages.length, 1);
    assert.ok(socket.sent.some(event => event.event === 'message_delivered' && event.payload.messageIds[0] === 'one'));
    const blur = focusChat('direct');
    socket.receive('message_received', message('visible', { timestamp: new Date(Date.now() + 1000).toISOString() }));
    blur();
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 1);
    foreground = false;
    socket.receive('message_received', message('background', { timestamp: new Date(Date.now() + 2000).toISOString() }));
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 2);
    foreground = true;
    socket.receive('message_received', message('mine', { senderType: 'CUSTOMER', timestamp: new Date(Date.now() + 3000).toISOString() }));
    assert.deepEqual(notifications, ['one']);
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 2);
  } finally { cleanup(); assert.equal(socket.listenerCount('message_received'), 0); cache.clear(); }
});

test('polling before socket delivery does not double-count unread; a receipt updates live and search bubbles without reloading', () => {
  const cache = client(), socket = new Socket(), seen = message('already-loaded');
  cache.setQueryData(chatKeys.all, [summary({ unreadCount: 1, lastMessageTime: seen.timestamp })]);
  cache.setQueryData(chatKeys.thread('direct'), thread([seen]));
  cache.setQueryData(chatKeys.messageSearch('direct', 'loaded'), thread([seen]));
  const cleanup = subscribeChatMessages(socket, cache, { actor, isForeground: () => true, notify: () => assert.fail('Polling replay must remain silent') });
  try {
    socket.receive('message_received', seen);
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 1);
    socket.receive('message_delivered', { chatId: 'direct', messageIds: [seen.id], userId: 1, userType: 'CUSTOMER', deliveredAt: seen.timestamp });
    socket.receive('message_read', { chatId: 'direct', messageIds: [seen.id], userId: 1, userType: 'CUSTOMER', readAt: seen.timestamp });
    for (const key of [chatKeys.thread('direct'), chatKeys.messageSearch('direct', 'loaded')]) {
      const stored = cache.getQueryData(key).pages[0].messages[0];
      assert.equal(stored.deliveredTo.length, 1); assert.equal(stored.readBy[0].userType, 'CUSTOMER');
    }
    upsertThreadMessage(cache, 'direct', seen);
    assert.equal(cache.getQueryData(chatKeys.thread('direct')).pages[0].messages[0].readBy.length, 1, 'late replay preserves read status');
    applyMessageReceipt(cache, { chatId: 'direct', messageIds: [seen.id], userId: 1, userType: 'EMPLOYEE', readAt: seen.timestamp });
    assert.equal(cache.getQueryData(chatKeys.thread('direct')).pages[0].messages[0].readBy.length, 1, 'self reads do not mark a message read');
  } finally { cleanup(); cache.clear(); }
});

test('retention prunes affected history and search immediately while preserving newer messages, pending drafts and other conversations', () => {
  const cache = client(), socket = new Socket();
  const cutoff = '2026-10-01T00:00:00Z';
  const messages = [message('expired', { timestamp: '2026-09-30T23:59:59Z' }), message('boundary', { timestamp: cutoff }), message('pending', { timestamp: '2026-09-01T00:00:00Z', pending: true }), message('failed', { timestamp: '2026-09-01T00:00:00Z', failed: true })];
  const affected = [chatKeys.thread('direct'), chatKeys.messageSearch('direct', 'word')];
  for (const key of [...affected, chatKeys.thread('other')]) cache.setQueryData(key, thread(messages));
  const cleanup = subscribeChatRefresh(socket, cache);
  try {
    socket.receive('chats_changed', { reason: 'retention', chatIds: ['direct'], cutoff });
    for (const key of affected) assert.deepEqual(cache.getQueryData(key).pages[0].messages.map(m => m.id), ['boundary', 'pending', 'failed']);
    assert.equal(cache.getQueryState(chatKeys.thread('direct')).isInvalidated, true);
    assert.equal(cache.getQueryState(chatKeys.thread('other')).isInvalidated, false);
    assert.equal(cache.getQueryData(chatKeys.thread('other')).pages[0].messages.length, 4);
  } finally { cleanup(); cache.clear(); }
});

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const nodes = node => typeof node === 'object' && node ? [node, ...(node.children ?? []).flatMap(nodes)] : [];
function openingHarness(platform, initial = {}) {
  const states = [], refs = [], effects = []; let stateIndex = 0, refIndex = 0, effectIndex = 0, tree;
  const request = deferred(), calls = { creates: [], routes: [] }, state = { focused: true, online: true, error: null, pending: false, next: null, ...initial };
  const create = input => { calls.creates.push(input); state.pending = true; state.error = null; return (state.next ?? request.promise).then(value => { state.pending = false; return value; }, error => { state.pending = false; state.error = error; throw error; }); };
  const router = { canGoBack: () => true, back: () => calls.routes.push('back'), replace: route => calls.routes.push(route) };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(Boolean) }),
    useRef: current => refs[refIndex++] ??= { current },
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useEffect: (effect, deps) => { const i = effectIndex++, previous = effects[i]; if (previous && deps.every((value, index) => Object.is(value, previous.deps[index]))) return; previous?.cleanup?.(); effects[i] = { deps, run: effect }; },
  };
  const module = { exports: {} };
  runInNewContext(compile('../src/app/(app)/chat/start.tsx'), { module, exports: module.exports, require(name) {
    if (name === 'react') return React;
    if (name === 'react-native') return { Platform: { OS: platform }, StyleSheet: { create: value => value, hairlineWidth: 1 }, ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'View'].map(value => [value, value])) };
    if (name === 'expo-router') return { useIsFocused: () => state.focused, useLocalSearchParams: () => ({ userId: '1', userType: 'EMPLOYEE', name: 'Alex' }), useRouter: () => router };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@/features/chat/components/chat-feedback') return { ChatNotice: 'ChatNotice' };
    if (name === '@/features/chat/components/message-timeline') return { MessageTimelineSkeleton: 'MessageTimelineSkeleton' };
    if (name === '@/features/chat/errors') return { getChatErrorState };
    if (name === '@/features/chat/hooks/use-chat-connection') return { useChatConnection: () => ({ isOnline: state.online }) };
    if (name === '@/features/chat/hooks/use-chats') return { useCreateChat: () => ({ mutateAsync: create, error: state.error, isPending: state.pending }) };
    if (name === '@/features/chat/theme') return { ChatColors, chatInitials };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const render = () => { stateIndex = 0; refIndex = 0; effectIndex = 0; tree = module.exports.default(); for (const entry of effects) if (entry.run) { const run = entry.run; entry.run = null; entry.cleanup = run(); } return tree; };
  render();
  return { state, calls, request, render, unmount: () => effects.forEach(entry => entry.cleanup?.()), find: label => nodes(tree).find(node => node.props.accessibilityLabel === label), type: type => nodes(tree).find(node => node.type === type) };
}
for (const platform of ['android', 'ios', 'web']) {
  test(`${platform}: direct opening shows a skeleton immediately and back cancels late navigation`, async () => {
    const ui = openingHarness(platform);
    assert.ok(ui.type('MessageTimelineSkeleton')); assert.equal(ui.calls.creates.length, 1);
    ui.find('Cancel opening conversation').props.onPress();
    ui.request.resolve(summary()); await tick();
    assert.deepEqual(ui.calls.routes, ['back']); ui.unmount();
  });
  test(`${platform}: offline opening waits without creating a room, then resumes on connection recovery`, async () => {
    const ui = openingHarness(platform, { online: false });
    assert.equal(ui.calls.creates.length, 0); assert.equal(ui.type('MessageTimelineSkeleton'), undefined);
    assert.equal(ui.type('ChatNotice').props.title, 'Waiting for a connection');
    ui.state.online = true; ui.render(); assert.equal(ui.calls.creates.length, 1);
    ui.request.resolve(summary()); await tick(); assert.equal(ui.calls.routes[0].params.id, 'direct'); ui.unmount();
  });
  test(`${platform}: opening retries after a network error and replaces only the initialization screen`, async () => {
    const ui = openingHarness(platform);
    ui.request.reject(new Error('Offline')); await tick(); ui.render();
    assert.ok(ui.type('ChatNotice')); assert.equal(ui.calls.routes.length, 0);
    // A retry starts a new attempt; the failed response never traps the back button.
    ui.state.next = Promise.resolve(summary());
    ui.type('ChatNotice').props.onAction(); ui.render(); await tick();
    assert.equal(ui.calls.creates.length, 2);
    assert.equal(ui.calls.routes[0].pathname, '/(app)/chat/[id]');
    assert.equal(ui.calls.routes[0].params.id, 'direct'); ui.unmount();
  });
}

test('direct selection opens cached threads immediately and ignores repeated taps before navigation settles', () => {
  for (const cached of [true, false]) {
    const cache = client(), routes = [], refs = []; let index = 0;
    if (cached) cache.setQueryData(chatKeys.all, [summary()]);
    const module = { exports: {} };
    runInNewContext(compile('../src/features/chat/hooks/use-open-direct-chat.ts'), { module, exports: module.exports, require(name) {
      if (name === 'react') return { useCallback: value => value, useRef: current => refs[index++] ??= { current }, useEffect: effect => effect() };
      if (name === 'expo-router') return { useIsFocused: () => true, useRouter: () => ({ push: route => routes.push(route) }) };
      if (name === '@tanstack/react-query') return { useQueryClient: () => cache };
      if (name === '@/contexts/AuthContext') return { useAuth: () => ({ user: { id: actor.userId, userType: actor.userType } }) };
      if (name === '@/features/supermarkets/scope') return { getSupermarketScope: () => scope };
      if (name === '../direct') return { findDirectChat };
      if (name === '../keys') return { chatKeys };
      throw new Error(`Unexpected dependency ${name}`);
    } });
    const open = module.exports.useOpenDirectChat();
    open({ id: '1', userType: 'EMPLOYEE', name: 'Alex' }); open({ id: '1', userType: 'EMPLOYEE', name: 'Alex' });
    assert.equal(routes.length, 1);
    assert.equal(routes[0].pathname, cached ? '/(app)/chat/[id]' : '/(app)/chat/start');
    assert.equal(routes[0].params[cached ? 'id' : 'userId'], cached ? 'direct' : '1');
    cache.clear();
  }
});

test('hardware/browser back unmount prevents room initialization from redirecting later', async () => {
  const ui = openingHarness('android');
  ui.unmount(); ui.request.resolve(summary()); await tick();
  assert.deepEqual(ui.calls.routes, []);
});

test('ordinary message and read hints never reload the eligible user directory', () => {
  const cache = client(), socket = new Socket();
  cache.setQueryData(chatKeys.users(''), [{ id: 1 }]);
  cache.setQueryData(chatKeys.all, [summary()]);
  cache.setQueryData(chatKeys.thread('direct'), thread([]));
  const cleanup = subscribeChatRefresh(socket, cache);
  try {
    socket.receive('chats_changed', { reason: 'read', chatId: 'direct' });
    assert.equal(cache.getQueryState(chatKeys.all).isInvalidated, true);
    assert.equal(cache.getQueryState(chatKeys.thread('direct')).isInvalidated, false);
    socket.receive('chats_changed', { reason: 'message', chatId: 'direct' });
    assert.equal(cache.getQueryState(chatKeys.thread('direct')).isInvalidated, false, 'the live payload already updated history');
    assert.equal(cache.getQueryState(chatKeys.users('')).isInvalidated, false);
  } finally { cleanup(); cache.clear(); }
});

test('distinct incoming message IDs sharing a timestamp each increment unread exactly once', () => {
  const cache = client(), socket = new Socket();
  cache.setQueryData(chatKeys.all, [summary()]); cache.setQueryData(chatKeys.thread('direct'), thread([]));
  const cleanup = subscribeChatMessages(socket, cache, { actor, isForeground: () => true, notify() {} });
  try {
    const timestamp = new Date().toISOString();
    socket.receive('message_received', message('first', { timestamp }));
    socket.receive('message_received', message('second', { timestamp }));
    socket.receive('message_received', message('second', { timestamp }));
    assert.equal(cache.getQueryData(chatKeys.all)[0].unreadCount, 2);
  } finally { cleanup(); cache.clear(); }
});
