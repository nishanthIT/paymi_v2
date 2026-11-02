import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { chatKeys } from '../src/features/chat/keys.ts';
import { subscribeChatRefresh } from '../src/features/chat/realtime-refresh.ts';

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('live roster changes refresh active contacts and invalidate every saved search and affected thread', async () => {
  const cache = client(), otherShop = client(), socket = new EventEmitter();
  const team = chatKeys.thread('team'), unrelated = chatKeys.thread('direct');
  for (const target of [cache, otherShop]) {
    target.setQueryData(chatKeys.all, [{ id: 'team', participantCount: 1 }]);
    target.setQueryData(chatKeys.users(''), [{ id: 'owner' }]);
    target.setQueryData(chatKeys.users('new employee'), []);
    target.setQueryData(team, { participants: [{ id: 'owner' }] });
    target.setQueryData(unrelated, { participants: [] });
    target.setQueryData(['products'], ['unchanged']);
  }
  const observer = new QueryObserver(cache, {
    queryKey: chatKeys.users(''), staleTime: Infinity,
    queryFn: async () => [{ id: 'owner' }, { id: 'employee' }],
  });
  const unsubscribe = observer.subscribe(() => {});
  const cleanup = subscribeChatRefresh(socket, cache);
  socket.emit('chat_participants_changed', { chatId: 'team', shopId: 'shop-a' });
  await tick();
  assert.deepEqual(cache.getQueryData(chatKeys.users('')).map(u => u.id), ['owner', 'employee']);
  for (const key of [chatKeys.all, chatKeys.users('new employee'), team]) {
    assert.equal(cache.getQueryState(key).isInvalidated, true);
    assert.equal(otherShop.getQueryState(key).isInvalidated, false);
  }
  assert.equal(cache.getQueryState(unrelated).isInvalidated, false);
  assert.equal(cache.getQueryState(['products']).isInvalidated, false);
  cleanup(); unsubscribe(); cache.clear(); otherShop.clear();
});

test('reconnect recovers missed events for lists, contacts and threads, and cleanup detaches all listeners', () => {
  const cache = client(), socket = new EventEmitter();
  const keys = [chatKeys.all, chatKeys.users(''), chatKeys.thread('one'), chatKeys.thread('two')];
  for (const key of keys) cache.setQueryData(key, []);
  const cleanup = subscribeChatRefresh(socket, cache);
  socket.emit('connect');
  for (const key of keys) assert.equal(cache.getQueryState(key).isInvalidated, true);
  cleanup();
  for (const key of keys) cache.setQueryData(key, []);
  for (const event of ['connect', 'chats_changed', 'new_chat_created', 'chat_participants_changed']) {
    assert.equal(socket.listenerCount(event), 0);
    socket.emit(event, { chatId: 'one' });
  }
  for (const key of keys) assert.equal(cache.getQueryState(key).isInvalidated, false);
  cache.clear();
});

test('legacy chats_changed events also expire the employee directory', () => {
  const cache = client(), socket = new EventEmitter();
  cache.setQueryData(chatKeys.users('member'), []);
  const cleanup = subscribeChatRefresh(socket, cache);
  socket.emit('chats_changed');
  assert.equal(cache.getQueryState(chatKeys.users('member')).isInvalidated, true);
  cleanup(); cache.clear();
});
