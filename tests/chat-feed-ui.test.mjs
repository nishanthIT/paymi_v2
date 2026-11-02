import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ChatColors, chatInitials } from '../src/features/chat/theme.ts';
import { getChatErrorState } from '../src/features/chat/errors.ts';
import { selectChatFeed } from '../src/features/chat/feed.ts';
import { formatConversationDate } from '../src/features/chat/dates.ts';
import { matchesSearch } from '../src/utils/search.ts';
import { chatKeys } from '../src/features/chat/keys.ts';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const feedSource = compile('../src/app/(app)/(tabs)/chat.tsx');
const directorySource = compile('../src/features/chat/components/new-chat-sheet.tsx');
const nodes = node => typeof node === 'object' && node ? [node, ...(node.children ?? []).flatMap(nodes)] : [];
const text = node => typeof node === 'string' ? node : (node?.children ?? []).map(text).join('');
const tick = () => new Promise(resolve => setImmediate(resolve));
const shop = { id: 'shop-one', name: 'High Street' };
const employee = { id: '2', name: 'Alex Smith', userType: 'EMPLOYEE', phone: '01234' };
const owner = { id: '1', name: 'Sam Owner', userType: 'CUSTOMER', phone: '' };
const chat = (id, overrides = {}) => ({ id, name: id, shopId: shop.id, type: 'PERSONAL', isTeamChat: false, unreadCount: 0, participants: [employee], participantCount: 2, otherParticipants: [employee], lastMessage: 'Current preview', lastMessageTime: '2026-10-25T10:00:00Z', ...overrides });
const fixtures = [chat('team', { type: 'GROUP', isTeamChat: true, unreadCount: 2 }), chat('project', { type: 'GROUP' }), chat('alex', { name: 'Alex Smith', unreadCount: 1 }), chat('read-direct'), chat('other-shop', { shopId: 'shop-two', unreadCount: 9 })];

/** Execute the real components; replace only native bindings and query results. */
function harness(kind = 'feed', platform = 'ios') {
  const slots = []; let index = 0; let tree;
  const calls = { searches: [], directorySearches: [], creates: [], routes: [], deletes: [], invalidations: [], selected: [], close: 0, refreshes: 0 };
  const initialQuery = data => ({ data, isError: false, isPending: false, isPaused: false, isFetching: false, isRefetching: false, isDebouncing: false, isPlaceholderData: false, refetch: async () => { calls.refreshes++; } });
  const state = {
    auth: { activeSupermarket: shop, shopsError: null, refreshSupermarkets: async () => {} },
    feed: initialQuery(fixtures), search: initialQuery([]), directory: initialQuery([owner, employee]),
    connection: { isOnline: true, isConnected: true }, creating: false, visible: true,
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(value => value !== false && value !== null && value !== undefined) }),
    useState: initial => { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo: fn => fn(), useCallback: value => value, memo: component => component,
  };
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'View'].map(key => [key, key]));
  const hooks = {
    useChats: () => state.feed,
    useChatSearch: (...args) => { calls.searches.push(args); return state.search; },
    useChatUserSearch: (...args) => { calls.directorySearches.push(args); return state.directory; },
    useCreateChat: () => ({ isPending: state.creating, mutate: (input, callbacks) => { calls.creates.push(input); callbacks.onSuccess({ id: 'existing-direct' }); } }),
  };
  const module = { exports: {} };
  runInNewContext(kind === 'feed' ? feedSource : directorySource, { module, exports: module.exports, require(name) {
    if (name === 'react') return React;
    if (name === 'react-native') return { ...native, Platform: { OS: platform }, StyleSheet: { create: value => value } };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async value => calls.invalidations.push(value.queryKey) }) };
    if (name === 'expo-router') return { useRouter: () => ({ push: route => calls.routes.push(route) }) };
    if (name === '@/contexts/AuthContext') return { useAuth: () => state.auth };
    if (name === '@/features/chat/hooks/use-chats' || name === '../hooks/use-chats') return hooks;
    if (name === '@/features/chat/hooks/use-open-direct-chat') return { useOpenDirectChat: () => user => calls.routes.push({ pathname: '/(app)/chat/start', params: { userId: user.id, userType: user.userType, name: user.name } }) };
    if (name === '@/features/chat/hooks/use-chat-connection') return { useChatConnection: () => state.connection };
    if (name === '@/features/chat/errors' || name === '../errors') return { getChatErrorState };
    if (name === '@/features/chat/theme' || name === '../theme') return { ChatColors, chatInitials };
    if (name === '@/features/chat/feed') return { selectChatFeed };
    if (name === '@/features/chat/dates') return { formatConversationDate };
    if (name === '@/features/chat/keys') return { chatKeys };
    if (name === '@/utils/search') return { matchesSearch };
    if (name === '@/features/chat/api') return { deleteChat: async id => { calls.deletes.push(id); } };
    if (name === '@/components/ui/toast') return { useToast: () => ({ showToast() {} }) };
    if (name === '@/components/ui/bottom-sheet') return { BottomSheet: 'BottomSheet' };
    if (name === '@/features/chat/components/new-chat-sheet') return { NewChatSheet: 'NewChatSheet' };
    if (name === '@/features/chat/components/chat-feedback' || name === './chat-feedback') return { ChatListSkeleton: 'ChatListSkeleton', ChatNotice: 'ChatNotice' };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const render = () => {
    index = 0;
    tree = kind === 'feed' ? module.exports.default() : module.exports.NewChatSheet({ visible: state.visible, creating: state.creating, onSelectUser: user => calls.selected.push(user), onClose: () => { calls.close++; } });
    return tree;
  };
  render();
  return {
    state, calls, render,
    find: label => nodes(tree).find(node => node.props.accessibilityLabel === label),
    type: type => nodes(tree).find(node => node.type === type),
    tab: label => nodes(tree).find(node => node.props.accessibilityRole === 'tab' && text(node) === label),
    action: label => nodes(tree).find(node => node.type === 'Pressable' && text(node) === label),
    rows: () => { const list = nodes(tree).find(node => node.type === 'FlatList'); return list.props.data.map(item => { const rendered = list.props.renderItem({ item }); return rendered.type(rendered.props); }); },
    ids: () => Array.from(nodes(tree).find(node => node.type === 'FlatList').props.data, item => item.id),
  };
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: Global Chat is pinned, cross-shop direct messages are visible, and private teams stay scoped`, () => {
    const ui = harness('feed', platform);
    const global = chat('global', { name: 'Global Chat', type: 'GROUP', shopId: null, isGlobalChat: true, isCommunityChat: true, lastMessageTime: '2020-01-01T00:00:00Z' });
    const direct = chat('cross-shop-direct', { shopId: null, isCommunityChat: true });
    ui.state.feed.data = [...fixtures, global, direct]; ui.render();
    assert.equal(ui.ids()[0], 'global');
    assert.ok(ui.ids().includes('cross-shop-direct'));
    assert.ok(!ui.ids().includes('other-shop'));
    ui.tab('Direct').props.onPress(); ui.render();
    assert.ok(ui.ids().includes('cross-shop-direct')); assert.ok(!ui.ids().includes('global'));
    ui.tab('Team Chat').props.onPress(); ui.render(); assert.deepEqual(ui.ids(), ['team']);
    ui.tab('All Chats').props.onPress(); ui.render();
    ui.rows().flatMap(nodes).find(node => node.props.accessibilityLabel === 'Global Chat').props.onPress();
    assert.equal(ui.calls.routes.at(-1).params.id, 'global');
  });

  test(`${platform}: four chat tabs retain the selected-shop boundary and valid group conversations`, () => {
    const ui = harness('feed', platform);
    assert.deepEqual(ui.ids(), ['team', 'project', 'alex', 'read-direct']);
    for (const [label, ids] of [['Team Chat', ['team']], ['Direct', ['alex', 'read-direct']], ['Unread', ['team', 'alex']], ['All Chats', ['team', 'project', 'alex', 'read-direct']]]) {
      ui.tab(label).props.onPress(); ui.render();
      assert.deepEqual(ui.ids(), ids);
      assert.equal(ui.tab(label).props.accessibilityState.selected, true);
    }
    assert.equal(ui.type('ScrollView').props.horizontal, true, 'the four tabs stay reachable on narrow screens');
    const row = ui.rows().flatMap(nodes).find(node => node.props.accessibilityLabel?.startsWith('Alex Smith'));
    row.props.onPress();
    assert.equal(ui.calls.routes[0].params.id, 'alex');
    assert.equal(ui.calls.routes[0].pathname, '/(app)/chat/[id]');
  });
}

test('conversation search displays authorized server matches from older history, not only current previews', () => {
  const ui = harness();
  ui.state.search.data = [chat('historical', { lastMessage: 'A newer unrelated preview' }), chat('wrong-shop-hit', { shopId: 'shop-two' })];
  ui.find('Search conversations and messages').props.onChangeText('old invoice phrase'); ui.render();
  assert.deepEqual(ui.calls.searches.at(-1), ['old invoice phrase', true]);
  assert.deepEqual(ui.ids(), ['historical']);
  ui.state.search.isDebouncing = true; ui.render();
  assert.deepEqual(ui.ids(), []);
  assert.equal(ui.type('FlatList').props.ListEmptyComponent.type, 'ChatListSkeleton');
  ui.find('Clear search').props.onPress(); ui.render();
  assert.deepEqual(ui.ids(), ['team', 'project', 'alex', 'read-direct']);
});

test('cached conversation lists survive background failures, while access denials hide every row', () => {
  const ui = harness();
  Object.assign(ui.state.feed, { isError: true, error: Object.assign(new Error('Unavailable'), { status: 503 }) }); ui.render();
  assert.equal(ui.ids().length, 4);
  assert.equal(ui.type('ChatNotice').props.title, 'Chat is temporarily unavailable');
  ui.state.feed.error.status = 403; ui.render();
  assert.deepEqual(ui.ids(), []);
  assert.equal(ui.type('ChatNotice').props.onAction, undefined);
});

test('offline first launch ends loading, and paused search only labels saved local matches', () => {
  const ui = harness();
  Object.assign(ui.state.feed, { data: undefined, isPaused: true, isPending: true }); ui.state.connection.isOnline = false; ui.render();
  assert.equal(ui.type('ChatNotice').props.title, "You're offline");
  assert.notEqual(ui.type('FlatList').props.ListEmptyComponent.type, 'ChatListSkeleton');
  assert.match(text(ui.type('FlatList').props.ListEmptyComponent), /Waiting for a connection/);
  ui.state.feed.data = fixtures; ui.state.search.isPaused = true;
  ui.find('Search conversations and messages').props.onChangeText('Alex'); ui.render();
  assert.equal(ui.ids().includes('other-shop'), false);
  assert.ok(ui.ids().includes('alex'));
  assert.match(ui.type('ChatNotice').props.message, /saved conversations/);
});

test('desktop options open an explicit confirmation and delete only the selected direct conversation', async () => {
  const ui = harness('feed', 'web');
  const row = ui.rows().find(row => nodes(row).some(node => node.props.accessibilityLabel?.startsWith('Alex Smith')));
  for (const button of nodes(row).filter(node => node.props.accessibilityRole === 'button')) {
    assert.equal(button.children.flatMap(nodes).some(child => child.props.accessibilityRole === 'button'), false, 'conversation controls must not nest buttons');
  }
  const options = nodes(row).find(node => node.props.accessibilityLabel === 'Conversation options for Alex Smith');
  options.props.onPress(); ui.render();
  assert.equal(ui.calls.routes.length, 0);
  assert.equal(ui.type('BottomSheet').props.visible, true);
  ui.action('Cancel').props.onPress(); ui.render();
  assert.equal(ui.type('BottomSheet').props.visible, false);
  assert.deepEqual(ui.calls.deletes, []);
  options.props.onPress(); ui.render();
  ui.find('Delete conversation').props.onPress(); await tick(); ui.render();
  assert.deepEqual(ui.calls.deletes, ['alex']);
  assert.equal(ui.type('BottomSheet').props.visible, false);
  assert.ok(ui.calls.invalidations.some(key => key[0] === chatKeys.all[0]));
  assert.ok(ui.calls.invalidations.some(key => key[0] === chatKeys.searches[0]));
  const team = ui.rows().find(row => nodes(row).some(node => node.props.accessibilityLabel?.startsWith('team')));
  assert.equal(nodes(team).some(node => String(node.props.accessibilityLabel).startsWith('Conversation options')), false);
});

test('starting a direct chat closes the picker and navigates immediately with the eligible identity', () => {
  const ui = harness();
  ui.find('New Chat').props.onPress(); ui.render();
  assert.equal(ui.type('NewChatSheet').props.visible, true);
  ui.type('NewChatSheet').props.onSelectUser(employee); ui.render();
  assert.equal(ui.calls.creates.length, 0);
  assert.equal(ui.calls.routes[0].pathname, '/(app)/chat/start');
  assert.equal(ui.calls.routes[0].params.userId, '2');
  assert.equal(ui.calls.routes[0].params.userType, 'EMPLOYEE');
  assert.equal(ui.type('NewChatSheet').props.visible, false);
  ui.state.auth.activeSupermarket = null; ui.render();
  assert.equal(ui.find('New Chat').props.disabled, true);
  assert.deepEqual(ui.ids(), []);
});

test('New Chat displays and selects server-authorized employees and owner without inventing users', () => {
  const ui = harness('directory');
  assert.ok(ui.find('Message Alex Smith')); assert.ok(ui.find('Message Sam Owner'));
  ui.find('Message Alex Smith').props.onPress();
  assert.equal(ui.calls.selected[0], employee);
  ui.state.creating = true; ui.render();
  assert.equal(ui.find('Message Alex Smith').props.disabled, true);
  assert.equal(ui.type('BottomSheet').props.keyboardAware, true);
  assert.equal(ui.type('BottomSheet').props.scrollable, true);
  assert.equal(ui.type('BottomSheet').props.sheetStyle.width, '100%');
  assert.ok(ui.type('BottomSheet').props.sheetStyle.maxWidth <= 560);
});

test('New Chat suppresses old directory rows during debounce and clears search on close', () => {
  const ui = harness('directory');
  ui.find('Search shop users').props.onChangeText('Different person');
  ui.state.directory.isDebouncing = true; ui.render();
  assert.equal(ui.find('Message Alex Smith'), undefined);
  assert.ok(ui.type('ChatListSkeleton'));
  assert.deepEqual(ui.calls.directorySearches.at(-1), ['Different person', true]);
  ui.find('Close new chat').props.onPress(); ui.render();
  assert.equal(ui.calls.close, 1);
  assert.equal(ui.find('Search shop users').props.value, '');
});

test('paused New Chat search cannot expose mismatched cached directory results', () => {
  const ui = harness('directory');
  ui.find('Search shop users').props.onChangeText('Different person');
  Object.assign(ui.state.directory, { isPaused: true, isDebouncing: true, isPlaceholderData: true }); ui.render();
  assert.equal(ui.find('Message Alex Smith'), undefined);
  assert.equal(ui.type('ChatListSkeleton'), undefined, 'offline waiting must not become an endless loading skeleton');
  assert.ok(ui.type('ChatNotice'));
});

test('New Chat hides cached directory rows when shop selection or access is lost', () => {
  const ui = harness('directory');
  ui.state.auth.activeSupermarket = null; ui.render();
  assert.equal(ui.find('Message Alex Smith'), undefined);
  ui.state.auth.activeSupermarket = shop;
  Object.assign(ui.state.directory, { isError: true, error: Object.assign(new Error('Forbidden'), { status: 403 }) }); ui.render();
  assert.equal(ui.find('Message Alex Smith'), undefined);
  assert.equal(ui.type('ChatNotice').props.onAction, undefined);
});

test('a canonical shop denial overrides cached search matches', () => {
  const ui = harness();
  ui.state.search.data = [chat('cached-search-match')];
  ui.find('Search conversations and messages').props.onChangeText('old invoice');
  Object.assign(ui.state.feed, { isError: true, error: Object.assign(new Error('Forbidden'), { status: 403 }) });
  ui.render();
  assert.deepEqual(ui.ids(), []);
  assert.equal(ui.type('ChatNotice').props.onAction, undefined);
});
