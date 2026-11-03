import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as axios from 'axios';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadApi(platform) {
  let token = null, pendingWrites = 0;
  const dependencies = {
    axios,
    'react-native': { Alert: {}, Platform: { OS: platform } },
    '@/features/supermarkets/scope': {
      getSupermarketScope: () => ({ id: 'shop-one', generation: 1 }),
      beginScopedWrite: () => { pendingWrites++; }, endScopedWrite: () => { pendingWrites--; },
    },
    '@/config/api': { API_CONFIG: { BASE_URL: 'https://backend.h7tex.com/api', TIMEOUT: 10000 } },
    '@/utils/authEvents': { authEvents: { emitLogout() {} } },
    '@/utils/secureStorage': { secureStorage: { getToken: async () => token, clearAll: async () => {} } },
    '@/utils/logger': { logger: { log() {}, warn() {} } },
  };
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const api = module.exports.default;
  const requests = [];
  // Inspect real Axios request/interceptor output without making network calls.
  api.defaults.adapter = async config => {
    requests.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  return { api, requests, signIn: () => { token = 'fixture-only-native-session'; }, pendingWrites: () => pendingWrites };
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: signed-out auth and authenticated shop requests use the intended session transport`, async () => {
    const { api, requests, signIn, pendingWrites } = loadApi(platform);
    for (const path of ['/auth/login', '/auth/register/send-otp', '/auth/forgot-password', '/auth/reset-password']) {
      await api.post(path, {});
      const request = requests.at(-1);
      assert.equal(request.withCredentials, platform === 'web', 'native auth must not attach an old OS session cookie');
      assert.equal(request.headers.get('Authorization'), undefined);
      assert.equal(request.headers.get('Origin'), undefined, 'a native client does not invent a trusted browser origin');
      assert.equal(pendingWrites(), 0);
    }
    signIn();
    await api.post('/lists', { name: 'Fixture list' });
    const request = requests.at(-1);
    assert.equal(request.withCredentials, platform === 'web');
    assert.equal(request.headers.get('Authorization'), 'Bearer fixture-only-native-session');
    assert.equal(request.headers.get('X-Supermarket-Id'), 'shop-one');
    assert.equal(pendingWrites(), 0);
  });
}
