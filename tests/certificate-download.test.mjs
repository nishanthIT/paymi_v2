import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadDownload(write) {
  const scope = { id: 'test-shop', generation: 1 };
  const bytes = new Uint8Array([1, 2, 3]);
  class Directory {
    create() {}
    static async pickDirectoryAsync() {
      return { createFile: () => ({ write }) };
    }
  }
  class File {
    static async downloadFileAsync() {
      return { exists: true, size: bytes.length, name: 'certificate.jpg', bytes: async () => bytes };
    }
  }
  const dependencies = {
    '@/features/supermarkets/scope': { getSupermarketScope: () => scope },
    'expo-file-system': { Directory, File, Paths: { cache: 'test-cache' } },
    'expo-sharing': {},
    'react-native': { Platform: { OS: 'android' } },
    '@/utils/secureStorage': { secureStorage: { getToken: async () => 'test-token' } },
    './api': { certificateImageUrl: () => 'https://example.test/certificate.jpg' },
  };
  const source = readFileSync(new URL('../src/features/certificates/download.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return module.exports.saveCertificateToFolder;
}

test('certificate save waits for SDK 58 asynchronous file write before reporting success', async () => {
  let finishWrite;
  const pending = new Promise(resolve => { finishWrite = resolve; });
  let written;
  let settled = false;
  const save = loadDownload(bytes => { written = bytes; return pending; });
  const result = save({ id: 'certificate-test', imageFileName: 'certificate.jpg' }).then(value => {
    settled = true;
    return value;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...written], [1, 2, 3]);
  assert.equal(settled, false);
  finishWrite();
  assert.equal(await result, true);
});

test('certificate save surfaces asynchronous storage failure instead of reporting success', async () => {
  const save = loadDownload(async () => { throw new Error('Storage is full'); });
  await assert.rejects(save({ id: 'certificate-test' }), /Could not save to that folder/);
});
