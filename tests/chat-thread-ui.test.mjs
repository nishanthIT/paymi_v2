import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ChatColors } from '../src/features/chat/theme.ts';
import { getChatErrorState } from '../src/features/chat/errors.ts';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const source = compile('../src/app/(app)/chat/[id].tsx');
const message = { id: 'saved-message', content: 'Existing history', timestamp: '2026-10-25T12:00:00Z', isOwnMessage: false };
const nodes = node => typeof node === 'object' && node ? [node, ...(node.children ?? []).flatMap(nodes)] : [];
const text = node => typeof node === 'string' ? node : (node?.children ?? []).map(text).join(' ');

function threadHarness(platform = 'ios') {
  const slots = []; let index = 0; let tree;
  const calls = { sends: [], deletes: [], pages: 0, searchPages: 0, refreshes: 0, searchRefreshes: 0, routes: [], searches: [], creates: [] };
  const state = {
    thread: { data: { pages: [{}] }, messages: [message], chatName: 'Shop team', chatType: 'GROUP', participants: [{ id: 1 }], isPending: false, isError: false, hasNextPage: true, isFetchingNextPage: false, fetchNextPage: () => { calls.pages++; }, refetch: () => { calls.refreshes++; } },
    search: { data: { pages: [{}] }, messages: [{ ...message, id: 'older-search-hit' }], isPending: false, isError: false, hasNextPage: true, isFetchingNextPage: false, isDebouncing: false, fetchNextPage: () => { calls.searchPages++; }, refetch: () => { calls.searchRefreshes++; } },
    connection: { isOnline: true, isConnected: true },
    suspension: null,
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(value => value !== false && value !== null && value !== undefined) }),
    useRef: initial => { const i = index++; return slots[i] ??= { current: initial }; },
    useState: initial => { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: value => value,
    useEffect: () => {},
  };
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Pressable', 'Text', 'TextInput', 'View'].map(key => [key, key]));
  const module = { exports: {} };
  const animation = { duration: () => animation };
  runInNewContext(source, { module, exports: module.exports, setTimeout, clearTimeout, require(name) {
    if (name === 'react') return React;
    if (name === 'react-native') return { ...native, Keyboard: { dismiss() {} }, Platform: { OS: platform }, StyleSheet: { create: value => value, hairlineWidth: 1 } };
    if (name === 'react-native-reanimated') return { default: { Text: 'Animated.Text', View: 'Animated.View' }, __esModule: true, FadeIn: animation, FadeInDown: animation, FadeOut: animation };
    if (name === 'expo-router') return { useLocalSearchParams: () => ({ id: 'chat-one' }), useIsFocused: () => true, useRouter: () => ({ canGoBack: () => false, back: () => calls.routes.push('back'), replace: route => calls.routes.push(route), push: route => calls.routes.push(route) }) };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data: { suspension: state.suspension }, refetch() {} }) };
    if (name === '@/features/chat/hooks/use-chat-thread') return {
      useChatThread: () => state.thread,
      useChatMessageSearch: (...args) => { calls.searches.push(args); return state.search; },
      useSendMessage: () => ({ mutate: input => calls.sends.push(input), mutateAsync: async input => calls.sends.push(input) }),
      useDeleteMessage: () => ({ mutate: id => calls.deletes.push(id) }),
      useThreadRealtime: () => ({ typingUsers: [] }), useTypingEmitter: () => ({ onInputChange() {} }),
    };
    if (name === '@/features/chat/hooks/use-chats') return { useCreateChat: () => ({ mutate: (input, callbacks) => { calls.creates.push(input); callbacks.onSuccess({ id: 'private-thread' }); callbacks.onSettled(); } }) };
    if (name === '@/features/chat/hooks/use-open-direct-chat') return { useOpenDirectChat: () => user => calls.routes.push({ pathname: '/(app)/chat/start', params: { userId: user.id, userType: user.userType, name: user.name } }) };
    if (name === '@/features/chat/hooks/use-chat-connection') return { useChatConnection: () => state.connection };
    if (name === '@/features/chat/errors') return { getChatErrorState };
    if (name === '@/features/chat/theme') return { ChatColors };
    if (name === '@/features/chat/components/message-timeline') return { MessageTimeline: 'MessageTimeline', MessageTimelineSkeleton: 'MessageTimelineSkeleton' };
    if (name === '@/features/chat/components/chat-camera') return { ChatCamera: 'ChatCamera' };
    if (name === '@/components/ui/bottom-sheet') return { BottomSheet: 'BottomSheet' };
    if (name === '@/components/ui/toast') return { useToast: () => ({ showToast() {} }) };
    if (name === '@/constants/theme') return { Typography: {}, Spacing: { md: 16 } };
    if (name === '@/features/chat/socket') return { getChatSocket: async () => null };
    if (name === '@/features/chat/api') return { uploadChatFile: async () => ({}) };
    if (name === '@/features/chat/photo-send') return { createPhotoSendSession() {} };
    if (name === '@/features/supermarkets/scope') return { getSupermarketScope: () => ({ generation: 1 }) };
    if (name === '@/services/api') return {};
    if (name === 'expo-clipboard') return { setStringAsync: async () => {} };
    if (name === 'expo-image-picker') return {};
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const render = () => { index = 0; tree = module.exports.default(); return tree; };
  render();
  return { state, calls, render, find: label => nodes(tree).find(node => node.props.accessibilityLabel === label), type: type => nodes(tree).find(node => node.type === type), action: label => nodes(tree).find(node => node.type === 'Pressable' && text(node) === label), text: () => text(tree) };
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: a global sender opens a personal conversation without losing the draft`, () => {
    const ui = threadHarness(platform);
    const sender = { ...message, senderId: 22, senderType: 'EMPLOYEE', senderName: 'Other shop employee' };
    ui.state.thread.participants = [{ id: 22, userType: 'EMPLOYEE' }];
    ui.find('Message').props.onChangeText('Keep my global draft'); ui.render();
    ui.type('MessageTimeline').props.onLongPress(sender); ui.render();
    ui.action('Message personally').props.onPress(); ui.render();
    assert.equal(ui.calls.creates.length, 0);
    assert.equal(ui.calls.routes[0].pathname, '/(app)/chat/start');
    assert.equal(ui.calls.routes[0].params.userId, '22');
    assert.equal(ui.calls.routes[0].params.userType, 'EMPLOYEE');
    assert.equal(ui.find('Message').props.value, 'Keep my global draft');
    ui.type('MessageTimeline').props.onLongPress({ ...sender, senderId: 99 }); ui.render();
    assert.equal(ui.action('Message personally'), undefined, 'ineligible historical senders cannot open a direct chat');
  });

  test(`${platform}: camera and full-history search can close without changing the text draft`, () => {
    const ui = threadHarness(platform);
    ui.find('Message').props.onChangeText('Keep my draft'); ui.render();
    ui.find('Open chat camera').props.onPress(); ui.render();
    assert.ok(ui.type('ChatCamera'));
    ui.type('ChatCamera').props.onClose(); ui.render();
    assert.equal(ui.type('ChatCamera'), undefined);
    assert.equal(ui.find('Message').props.value, 'Keep my draft');
    ui.find('Search messages').props.onPress(); ui.render();
    ui.find('Search this conversation').props.onChangeText('historic delivery'); ui.render();
    assert.deepEqual(ui.calls.searches.at(-1), ['chat-one', 'historic delivery', true]);
    assert.equal(ui.type('MessageTimeline').props.messages[0].id, 'older-search-hit');
    ui.type('MessageTimeline').props.onLoadOlder();
    assert.equal(ui.calls.searchPages, 1); assert.equal(ui.calls.pages, 0);
    ui.find('Close message search').props.onPress(); ui.render();
    assert.equal(ui.type('MessageTimeline').props.messages[0].id, 'saved-message');
    assert.equal(ui.find('Message').props.value, 'Keep my draft');
    ui.find('Send message').props.onPress(); ui.render();
    assert.equal(ui.calls.sends[0].content, 'Keep my draft');
    assert.equal(ui.find('Message').props.value, '');
  });

  test(`${platform}: cached history remains readable after refresh failure, but access denial closes it`, () => {
    const ui = threadHarness(platform);
    ui.state.thread.isError = true; ui.state.thread.error = Object.assign(new Error('Unavailable'), { status: 503 }); ui.render();
    assert.ok(ui.type('MessageTimeline'));
    assert.equal(ui.find('Message').props.editable, true);
    ui.find('Refresh messages').props.onPress(); assert.equal(ui.calls.refreshes, 1);
    ui.state.connection.isOnline = false; ui.render();
    assert.match(ui.text(), /offline/); assert.ok(ui.type('MessageTimeline'));
    ui.state.thread.error.status = 403; ui.render();
    assert.equal(ui.type('MessageTimeline'), undefined);
    assert.equal(ui.find('Message').props.editable, false);
    assert.equal(ui.find('Open chat camera').props.disabled, true);
    assert.match(ui.text(), /does not have access/);
  });
}

test('failed sends preserve their idempotency identity when retried from message actions', () => {
  const ui = threadHarness('web');
  ui.type('MessageTimeline').props.onLongPress({ ...message, isOwnMessage: true, failed: true, clientMessageId: 'stable-send-key' }); ui.render();
  ui.action('Retry send').props.onPress();
  assert.equal(ui.calls.sends[0].clientMessageId, 'stable-send-key');
  assert.deepEqual(ui.calls.deletes, ['saved-message']);
});

test('history pagination failure has an explicit retry without replacing loaded messages', () => {
  const ui = threadHarness();
  Object.assign(ui.state.thread, { isError: true, isFetchNextPageError: true, error: new Error('Offline') }); ui.render();
  assert.ok(ui.type('MessageTimeline').props.loadOlderError);
  ui.type('MessageTimeline').props.onLoadOlder(); assert.equal(ui.calls.pages, 1);
  assert.equal(ui.type('MessageTimeline').props.messages[0].id, 'saved-message');
});

test('offline first-load waiting replaces the loading skeleton and keeps the existing draft', () => {
  const ui = threadHarness();
  ui.find('Message').props.onChangeText('Draft before connection loss');
  Object.assign(ui.state.thread, { isPaused: true, isPending: true, data: undefined, messages: [] });
  ui.state.connection.isOnline = false; ui.render();
  assert.equal(ui.type('MessageTimelineSkeleton'), undefined);
  assert.equal(ui.type('MessageTimeline'), undefined);
  assert.match(ui.text(), /Waiting for a connection/);
  assert.equal(ui.find('Message').props.value, 'Draft before connection loss');
});

test('message search hides earlier-query matches and counts throughout debounce, including offline', () => {
  const ui = threadHarness();
  ui.find('Search messages').props.onPress(); ui.render();
  ui.find('Search this conversation').props.onChangeText('old phrase'); ui.render();
  assert.ok(ui.type('MessageTimeline'));
  ui.find('Search this conversation').props.onChangeText('different phrase');
  ui.state.search.isDebouncing = true; ui.render();
  assert.equal(ui.type('MessageTimeline'), undefined);
  assert.ok(ui.type('MessageTimelineSkeleton'));
  assert.doesNotMatch(ui.text(), /message found/);
  ui.state.search.isPaused = true; ui.state.connection.isOnline = false; ui.render();
  assert.equal(ui.type('MessageTimeline'), undefined);
  assert.equal(ui.type('MessageTimelineSkeleton'), undefined);
  assert.match(ui.text(), /Search will resume/);
});

test('access revoked during message search hides cached results and disables sending', () => {
  const ui = threadHarness();
  ui.find('Search messages').props.onPress(); ui.render();
  ui.find('Search this conversation').props.onChangeText('historic');
  Object.assign(ui.state.search, { isError: true, error: Object.assign(new Error('Forbidden'), { status: 403 }) }); ui.render();
  assert.equal(ui.type('MessageTimeline'), undefined);
  assert.equal(ui.find('Message').props.editable, false);
  assert.match(ui.text(), /does not have access/);
});

test('suspension preserves readable history, safety route and deep-link back navigation', () => {
  const ui = threadHarness();
  ui.state.suspension = { until: '2026-10-26T00:00:00Z', reason: 'Pending review' }; ui.render();
  assert.ok(ui.type('MessageTimeline'));
  assert.equal(ui.find('Message').props.editable, false);
  ui.find('Chat safety and community rules').props.onPress();
  ui.find('Back to conversations').props.onPress();
  assert.deepEqual(ui.calls.routes, ['/chat-safety', '/(app)/(tabs)/chat']);
});

test('photo bubbles fit narrow mobile and desktop widths; desktop actions and image retry remain available', () => {
  const compiled = compile('../src/features/chat/components/message-bubble.tsx');
  for (const width of [320, 375, 768, 1440]) {
    const slots = []; let index = 0; let actions = 0;
    const React = {
      memo: fn => fn,
      createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(Boolean) }),
      useState: initial => { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = next; }]; },
    };
    const module = { exports: {} };
    runInNewContext(compiled, { module, exports: module.exports, require(name) {
      if (name === 'react') return React;
      if (name === 'react-native') return { Platform: { OS: 'web' }, Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width }) };
      if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (name === '@/components/ui/private-image') return { PrivateImage: 'PrivateImage' };
      if (name === '@/constants/theme') return { BorderRadius: { md: 12 }, Spacing: { sm: 8, md: 16 }, Typography: {} };
      if (name === '../theme') return { ChatColors };
      if (name === '../api') return { getAttachmentUrl: value => value };
      throw new Error(`Unexpected dependency ${name}`);
    } });
    const photo = { ...message, senderName: 'Shop member', messageType: 'IMAGE', attachmentUrl: '/private-photo', attachmentName: 'photo.jpg' };
    const render = () => { index = 0; return module.exports.MessageBubble({ message: photo, isGroup: true, onLongPress: () => { actions++; } }); };
    let tree = render();
    const button = nodes(tree).find(node => node.type === 'Pressable');
    const bubble = nodes(tree).find(node => node.type === 'View' && node.children.some(child => child?.type === 'Pressable'));
    const bubbleStyle = Object.assign({}, ...bubble.props.style.filter(Boolean));
    const assertIndependentButtons = (node, hasButtonParent = false) => {
      if (!node || typeof node !== 'object') return;
      const isButton = node.props.accessibilityRole === 'button';
      assert.ok(!(isButton && hasButtonParent), 'independent sender/retry actions must not nest accessible buttons');
      node.children.forEach(child => assertIndependentButtons(child, hasButtonParent || isButton));
    };
    assertIndependentButtons(tree);
    const photoNode = nodes(tree).find(node => node.type === 'PrivateImage');
    const imageStyle = Object.assign({}, ...photoNode.props.style);
    assert.ok(bubbleStyle.maxWidth <= width - 32);
    assert.ok(imageStyle.width + 24 <= bubbleStyle.maxWidth);
    assert.ok(bubbleStyle.maxWidth <= 560, 'desktop messages retain a readable line length');
    button.props.onPress(); assert.equal(actions, 1);
    nodes(tree).find(node => node.props.accessibilityLabel === 'Actions for Shop member').props.onPress();
    assert.equal(actions, 2, 'sender action still opens the message menu');
    button.props.onLongPress(); assert.equal(actions, 3, 'native long-press action remains available');
    photoNode.props.onError(); tree = render();
    const retry = nodes(tree).find(node => node.props.accessibilityLabel === 'Retry loading photo');
    assert.ok(retry);
    assertIndependentButtons(tree);
    retry.props.onPress(); tree = render();
    assert.equal(actions, 3, 'retry does not open the sibling message menu');
    assert.ok(nodes(tree).find(node => node.type === 'PrivateImage'));
  }
});
