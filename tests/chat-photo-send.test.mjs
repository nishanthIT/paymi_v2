import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createPhotoSendSession, createChatUploadBody } from '../src/features/chat/photo-send.ts';

const photo = { uri: 'file:///cache/camera.jpg', name: 'camera.jpg', mimeType: 'image/jpeg' };
const attachment = { url: '/uploads/camera.jpg', name: 'camera.jpg', size: 45000, type: 'IMAGE', mimetype: 'image/jpeg' };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('preview/cancel does not upload; confirmation uploads and sends the correct photo payload once', async () => {
  const uploaded = []; const sent = [];
  const session = createPhotoSendSession(photo, {
    upload: async (...args) => { uploaded.push(args); return attachment; },
    send: async message => { sent.push(message); },
    canSend: () => true,
  });
  assert.equal(uploaded.length, 0);
  assert.equal(sent.length, 0);
  await session.send();
  await session.send();
  assert.deepEqual(uploaded.map(args => args.slice(0, 3)), [[photo.uri, photo.name, photo.mimeType]]);
  assert.ok(uploaded[0][3] instanceof AbortSignal);
  assert.deepEqual(sent, [{ clientMessageId: '/uploads/camera.jpg', content: 'camera.jpg', messageType: 'IMAGE', attachmentUrl: '/uploads/camera.jpg', attachmentName: 'camera.jpg', attachmentSize: 45000 }]);
});

test('rapid repeated send taps share both upload and message submission', async () => {
  const upload = deferred(); const message = deferred(); let uploads = 0; let sends = 0;
  const session = createPhotoSendSession(photo, {
    upload: async () => { uploads += 1; return upload.promise; },
    send: async () => { sends += 1; return message.promise; },
    canSend: () => true,
  });
  const first = session.send();
  assert.equal(session.send(), first);
  upload.resolve(attachment);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(session.send(), first);
  message.resolve();
  await first;
  assert.equal(uploads, 1);
  assert.equal(sends, 1);
});

test('retry after message failure reuses the uploaded photo without uploading twice', async () => {
  let uploads = 0; let sends = 0;
  const clientMessageIds = [];
  const session = createPhotoSendSession(photo, {
    upload: async () => { uploads += 1; return attachment; },
    send: async message => { clientMessageIds.push(message.clientMessageId); sends += 1; if (sends === 1) throw new Error('Connection lost'); },
    canSend: () => true,
  });
  await assert.rejects(session.send(), /Connection lost/);
  await session.send();
  assert.equal(uploads, 1);
  assert.equal(sends, 2);
  assert.deepEqual(clientMessageIds, [attachment.url, attachment.url]);
});

test('upload failure sends no message and allows retrying the same retained photo', async () => {
  let uploads = 0; let sends = 0;
  const session = createPhotoSendSession(photo, {
    upload: async () => { uploads += 1; if (uploads === 1) throw new Error('Upload failed'); return attachment; },
    send: async () => { sends += 1; },
    canSend: () => true,
  });
  await assert.rejects(session.send(), /Upload failed/);
  assert.equal(sends, 0);
  await session.send();
  assert.equal(uploads, 2);
  assert.equal(sends, 1);
});

test('restricted users cannot upload or send and a membership change during upload blocks the message', async () => {
  let allowed = false; let uploads = 0; let sends = 0;
  const pending = deferred();
  const session = createPhotoSendSession(photo, {
    upload: async () => { uploads += 1; return pending.promise; },
    send: async () => { sends += 1; },
    canSend: () => allowed,
  });
  await assert.rejects(session.send(), /Messaging is unavailable/);
  assert.equal(uploads, 0);
  allowed = true;
  const sending = session.send();
  allowed = false;
  pending.resolve(attachment);
  await assert.rejects(sending, /Messaging is unavailable/);
  assert.equal(sends, 0);
});

test('web camera data URLs become a multipart image file instead of a native URI object', async () => {
  const data = await createChatUploadBody({ ...photo, uri: 'data:image/jpeg;base64,aGVsbG8=' }, 'web');
  const file = data.get('file');
  assert.equal(file.name, 'camera.jpg');
  assert.equal(file.type, 'image/jpeg');
  assert.equal(await file.text(), 'hello');
});

test('web upload can read gallery blob URLs and surfaces unreadable photo errors', async () => {
  const uri = URL.createObjectURL(new Blob(['photo bytes'], { type: 'image/png' }));
  try {
    const data = await createChatUploadBody({ uri, name: 'picked.png', mimeType: 'image/png' }, 'web');
    assert.equal(data.get('file').name, 'picked.png');
    assert.equal(data.get('file').type, 'image/png');
    assert.equal(await data.get('file').text(), 'photo bytes');
  } finally { URL.revokeObjectURL(uri); }
  await assert.rejects(createChatUploadBody({ ...photo, uri }, 'web'));
});

test('Android/iOS upload readable File objects and preserve local/content URI inputs', async () => {
  const read = [];
  const nativeFile = async uri => { read.push(uri); return new File(['native photo bytes'], 'capture.jpg', { type: 'image/jpeg' }); };
  for (const platform of ['android', 'ios']) {
    const data = await createChatUploadBody(photo, platform, nativeFile);
    assert.equal(data.get('file').name, 'capture.jpg');
    assert.equal(data.get('file').type, 'image/jpeg');
    assert.equal(await data.get('file').text(), 'native photo bytes');
  }
  await createChatUploadBody({ ...photo, uri: 'content://media/123' }, 'android', nativeFile);
  await createChatUploadBody({ ...photo, uri: '/cache/photo.jpg' }, 'ios', nativeFile);
  assert.deepEqual(read, [photo.uri, photo.uri, 'content://media/123', 'file:///cache/photo.jpg']);
});

test('native multipart payload passes the installed Expo SDK serializer; legacy URI objects fail', async () => {
  const loadSdk = path => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    runInNewContext(compiled, { module, exports: module.exports, Blob, Uint8Array, TextEncoder,
      require: () => ({ blobToArrayBufferAsync: blob => blob.arrayBuffer() }) });
    return module.exports;
  };
  const { installFormDataPatch } = loadSdk('../node_modules/expo/src/winter/FormData.ts');
  const { convertFormDataAsync } = loadSdk('../node_modules/expo/src/winter/fetch/convertFormData.ts');
  const previous = globalThis.FormData;
  class NativeFormData { _parts = []; }
  globalThis.FormData = installFormDataPatch(NativeFormData);
  try {
    // Expo File implements Blob with bytes(), but does not inherit the global Blob class.
    const file = { name: 'camera.jpg', type: 'image/jpeg', bytes: async () => new TextEncoder().encode('native camera bytes') };
    const body = await createChatUploadBody(photo, 'android', async () => file);
    const encoded = await convertFormDataAsync(body, 'test-boundary');
    const multipart = new TextDecoder().decode(encoded.body);
    assert.match(multipart, /filename="camera.jpg"/);
    assert.match(multipart, /content-type: image\/jpeg/);
    assert.match(multipart, /native camera bytes/);
    const legacy = new FormData(); legacy.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType });
    await assert.rejects(convertFormDataAsync(legacy), /Unsupported FormDataPart/);
  } finally { globalThis.FormData = previous; }
});

test('closing the camera aborts a pending upload and prevents a late upload from sending', async () => {
  const pending = deferred(); let signal; let sends = 0;
  const session = createPhotoSendSession(photo, {
    upload: async (_uri, _name, _type, value) => { signal = value; return pending.promise; },
    send: async () => { sends += 1; }, canSend: () => true,
  });
  const result = session.send();
  session.cancel();
  assert.equal(signal.aborted, true);
  pending.resolve(attachment);
  await assert.rejects(result, /Messaging is unavailable/);
  await assert.rejects(session.send(), /Messaging is unavailable/);
  assert.equal(sends, 0);
});
