import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/features/chat/hooks/use-chat-connection.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function connectionHarness(getSocket) {
  const auth = { isAuthenticated: true, activeSupermarket: { id: 'shop-one' } };
  let state, deps, cleanup, commits = 0, online = true;
  const module = { exports: {} };
  runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === '@/contexts/AuthContext') return { useAuth: () => auth };
    if (name === '../socket') return { getChatSocket: getSocket };
    if (name === '@tanstack/react-query') return { onlineManager: { isOnline: () => online, subscribe: () => () => {} } };
    if (name === 'react') return {
      useSyncExternalStore: (_subscribe, read) => read(),
      useState: initial => {
        state ??= initial;
        return [state, next => {
          const value = typeof next === 'function' ? next(state) : next;
          if (!Object.is(value, state)) { state = value; commits++; }
        }];
      },
      useEffect: (effect, nextDeps) => {
        if (!deps || nextDeps.some((value, index) => value !== deps[index])) {
          cleanup?.(); deps = nextDeps; cleanup = effect();
        }
      },
    };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return { auth, render: () => module.exports.useChatConnection(), commits: () => commits,
    offline: () => { online = false; }, close: () => cleanup?.() };
}

test('repeated disconnected transport failures do not trigger chat screen state updates', async () => {
  const socket = Object.assign(new EventEmitter(), { connected: false });
  const hook = connectionHarness(async () => socket);
  try {
    hook.render(); await Promise.resolve();
    const initialCommits = hook.commits();
    for (let i = 0; i < 30; i++) socket.emit('connect_error', new Error('xhr poll error'));
    assert.equal(hook.commits(), initialCommits);
    assert.equal(hook.render().isConnected, false);

    socket.connected = true; socket.emit('connect');
    assert.equal(hook.commits(), initialCommits + 1);
    assert.equal(hook.render().isConnected, true);
    socket.emit('connect');
    assert.equal(hook.commits(), initialCommits + 1);

    socket.connected = false; socket.emit('disconnect');
    assert.equal(hook.commits(), initialCommits + 2);
    assert.equal(hook.render().isConnected, false);
    for (let i = 0; i < 30; i++) socket.emit('connect_error', new Error('xhr poll error'));
    assert.equal(hook.commits(), initialCommits + 2);
  } finally { hook.close(); }
  for (const event of ['connect', 'disconnect', 'connect_error']) assert.equal(socket.listenerCount(event), 0);
});

test('a stale shop connection cannot update the next shop or leave listeners after logout', async () => {
  const pending = [];
  const hook = connectionHarness(() => new Promise(resolve => pending.push(resolve)));
  const oldSocket = Object.assign(new EventEmitter(), { connected: true });
  const currentSocket = Object.assign(new EventEmitter(), { connected: true });
  hook.render();
  hook.auth.activeSupermarket = { id: 'shop-two' };
  hook.render();
  pending[0](oldSocket); await Promise.resolve();
  assert.equal(oldSocket.eventNames().length, 0);
  assert.equal(hook.render().isConnected, false);
  pending[1](currentSocket); await Promise.resolve();
  assert.equal(hook.render().isConnected, true);

  hook.auth.isAuthenticated = false;
  assert.equal(hook.render().isConnected, false);
  assert.equal(currentSocket.eventNames().length, 0);
  hook.close();
});
