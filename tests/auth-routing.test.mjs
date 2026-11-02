import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Use the installed SDK's route matcher and guard fallback logic. Only screen
// rendering and platform providers are substituted; no backend login is needed.
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/fork/getStateFromPath');
const { parsePathFromExpoGoLink } = require('expo-router/build/fork/extractPathFromURL');
const { GuardContextProvider, useGuardRedirect } = require('expo-router/build/layouts/GuardContext');
const appRoot = fileURLToPath(new URL('../src/app', import.meta.url));
const routeFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.[jt]sx?$/.test(path)) routeFiles.push(`./${relative(appRoot, path)}`);
  }
}
walk(appRoot);
const context = Object.assign(() => ({ default: () => null }), { keys: () => routeFiles });

function renderRoot(auth) {
  const Stack = { Protected: 'Protected', Screen: 'Screen' };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: {
      ...props, ...(children.length ? { children: children.flat(Infinity) } : {}),
    } }),
    Fragment: 'Fragment',
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  };
  const dependencies = {
    react,
    'expo-router': { Stack },
    'expo-router/react-navigation': { DefaultTheme: { colors: {} }, ThemeProvider: 'ThemeProvider' },
    'expo-splash-screen': { preventAutoHideAsync: async () => {} },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reanimated': {},
    '@tanstack/react-query-persist-client': { PersistQueryClientProvider: 'PersistQueryClientProvider' },
    '@/features/supermarkets/selection': { supermarketCacheKey: () => 'test-shop' },
    '@/components/animated-splash': { AnimatedSplash: 'AnimatedSplash' },
    '@/components/ui/toast': { ToastProvider: 'ToastProvider' },
    '@/constants/theme': { Colors: { light: {} } },
    '@/contexts/AuthContext': { AuthProvider: 'AuthProvider', useAuth: () => ({ user: null, ...auth }) },
    '@/features/lists/mutation-defaults': { registerListMutationDefaults: () => {} },
    '@/features/price-reports/hooks': { registerPriceReportMutationDefaults: () => {} },
    '@/lib/query-client': { createQueryClient: () => ({}), createQueryPersister: () => ({}), setActiveQueryClient: () => {} },
  };
  const source = readFileSync(join(appRoot, '_layout.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected root dependency: ${name}`);
    return dependencies[name];
  } });
  const nodes = [];
  function render(node) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'function') return render(node.type(node.props));
    nodes.push(node);
    for (const child of [node.props.children].flat(Infinity)) render(child);
  }
  render(module.exports.default());
  const guards = new Map();
  for (const node of nodes.filter(n => n.type === 'Protected' && !n.props.guard)) {
    for (const child of node.props.children) guards.set(child.props.name, node.props.redirectTo);
  }
  return { nodes, guards, hasNavigator: nodes.some(n => n.type === Stack) };
}

function guardDestination(tree, guards, route) {
  let destination;
  function Probe() { destination = useGuardRedirect(route); return null; }
  renderToStaticMarkup(React.createElement(GuardContextProvider, { node: tree, guardedRedirects: guards }, React.createElement(Probe)));
  return destination;
}
function segments(config, href) {
  let state = getStateFromPath(href, config);
  const result = [];
  while (state) {
    const route = state.routes[state.index ?? state.routes.length - 1];
    result.push(route.name);
    state = route.state;
  }
  return result;
}

test('session restoration keeps the initial URL pending instead of redirecting before auth is known', () => {
  const root = renderRoot({ isRestoring: true, isAuthenticated: false });
  assert.equal(root.hasNavigator, false);
  assert.equal(root.nodes.find(n => n.type === 'AnimatedSplash').props.ready, false);
});

for (const platform of ['ios', 'android', 'web']) {
  const tree = getRoutes(context, { platform });
  const config = getReactNavigationConfig(tree);

  test(`${platform}: cold signed-out launch and logout resolve the protected home to login`, () => {
    assert.deepEqual(segments(config, '/'), ['(app)', '(tabs)', 'index']);
    const launchPath = parsePathFromExpoGoLink('exp://192.168.1.188:8081/--/');
    assert.deepEqual(segments(config, launchPath), ['(app)', '(tabs)', 'index']);
    // This is the old implicit fallback responsible for the reported screen.
    assert.deepEqual(segments(config, '/(auth)'), ['+not-found']);
    const root = renderRoot({ isRestoring: false, isAuthenticated: false });
    assert.equal(root.hasNavigator, true);
    const target = guardDestination(tree, root.guards, '(app)');
    assert.equal(target, '/(auth)/login');
    assert.deepEqual(segments(config, target), ['(auth)', 'login']);
  });

  test(`${platform}: login and restored sessions resolve to home without breaking chat deep links`, () => {
    const root = renderRoot({ isRestoring: false, isAuthenticated: true });
    assert.equal(root.hasNavigator, true);
    assert.equal(guardDestination(tree, root.guards, '(app)'), undefined);
    const target = guardDestination(tree, root.guards, '(auth)');
    assert.equal(target, '/(app)/(tabs)');
    assert.deepEqual(segments(config, target), ['(app)', '(tabs)', 'index']);
    assert.deepEqual(segments(config, '/chat/test-thread'), ['(app)', 'chat/[id]']);
    assert.deepEqual(segments(config, '/chat-safety'), ['chat-safety']);
  });
}
