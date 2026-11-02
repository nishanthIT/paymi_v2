import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real component with only native view/camera bindings substituted.
// This verifies event behavior; device safe-area geometry still needs native QA.
function cameraHarness(platform, permission = { granted: true, status: 'granted' }) {
  const source = readFileSync(new URL('../src/features/chat/components/chat-camera.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const slots = []; let index = 0, closed = 0, send = async () => {}, capture = async () => ({ uri: 'file:///camera.jpg' });
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(Boolean) }),
    useRef: initial => { const i = index++; return slots[i] ??= { current: initial }; },
    useState: initial => { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: value => value,
    useEffect: () => {},
  };
  const native = Object.fromEntries(['ActivityIndicator', 'Image', 'Modal', 'Pressable', 'Text', 'View', 'ScrollView'].map(key => [key, key]));
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, setTimeout, clearTimeout, require(name) {
    if (name === 'react') return React;
    if (name === 'react-native') return { ...native, Platform: { OS: platform }, StyleSheet: { create: v => v, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } }, AppState: { currentState: 'active' } };
    if (name === 'expo-camera') return { CameraView: 'CameraView', useCameraPermissions: () => [permission, async () => permission, async () => permission] };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name === '@/constants/theme') return { Colors: { light: { primary: 'blue' } }, Spacing: { sm: 8, md: 16, lg: 24, xl: 32 }, Typography: {} };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  let tree;
  const nodes = node => [node, ...node.children.filter(child => typeof child === 'object').flatMap(nodes)];
  const render = () => {
    index = 0;
    tree = module.exports.ChatCamera({ onClose: () => { closed++; }, onSend: photo => send(photo) });
    const preview = nodes(tree).find(n => n.type === 'CameraView');
    if (preview) preview.props.ref.current = { takePictureAsync: () => capture() };
    return tree;
  };
  render();
  return {
    render, find: label => nodes(tree).find(n => n.props.accessibilityLabel === label),
    type: type => nodes(tree).find(n => n.type === type),
    setSend: fn => { send = fn; }, setCapture: fn => { capture = fn; }, get closed() { return closed; },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

for (const platform of ['android', 'ios']) {
  test(`${platform}: modal-local safe area keeps the close control separate from a constrained preview`, () => {
    const ui = cameraHarness(platform);
    assert.equal(ui.type('Modal').children[0].type, 'SafeAreaProvider');
    assert.equal(ui.type('SafeAreaProvider').children[0].type, 'SafeAreaView');
    assert.equal(ui.type('CameraView').props.style.position, 'absolute');
    assert.equal(ui.find('Close camera').props.disabled, undefined);
    ui.find('Close camera').props.onPress();
    assert.equal(ui.closed, 1);
  });

  test(`${platform}: X and device back close permission-denied, capture and sending states`, async () => {
    const denied = cameraHarness(platform, { granted: false, status: 'denied', canAskAgain: false });
    denied.type('Modal').props.onRequestClose(); assert.equal(denied.closed, 1);
    const capturing = cameraHarness(platform), pendingCapture = deferred();
    capturing.setCapture(() => pendingCapture.promise);
    capturing.type('CameraView').props.onCameraReady(); capturing.render();
    capturing.find('Take photo').props.onPress(); capturing.render();
    capturing.find('Close camera').props.onPress();
    pendingCapture.resolve({ uri: 'file:///late.jpg' }); await tick(); capturing.render();
    assert.equal(capturing.closed, 1); assert.equal(capturing.find('Photo preview'), undefined);

    const sending = cameraHarness(platform), pendingSend = deferred();
    sending.type('CameraView').props.onCameraReady(); sending.render();
    sending.find('Take photo').props.onPress(); await tick(); sending.render();
    assert.ok(sending.find('Photo preview'));
    sending.setSend(() => pendingSend.promise);
    sending.find('Send photo').props.onPress(); sending.render();
    assert.equal(sending.find('Sending photo').props.disabled, true);
    assert.equal(sending.find('Close camera').props.disabled, undefined);
    sending.type('Modal').props.onRequestClose(); assert.equal(sending.closed, 1);
    pendingSend.resolve(); await tick(); assert.equal(sending.closed, 1, 'a completed background send must not close a new camera session');
  });
}
