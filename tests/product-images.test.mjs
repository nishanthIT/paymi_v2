import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';

globalThis.__DEV__ = false;
const { getProductImageCandidates, getProductImageUrl } = await import('../src/utils/product-image.ts');
const { API_CONFIG } = await import('../src/config/api.ts');
const base = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
const lookup = (ean) => `${base}/api/image/${ean}`;

test('catalogue image URLs normalize across search, lists, expiry and label API shapes', () => {
  assert.equal(getProductImageUrl(' /images/a product.jpg '), `${base}/images/a%20product.jpg`);
  assert.equal(getProductImageUrl('api/image/00123456'), lookup('00123456'));
  assert.equal(getProductImageUrl('//supplier.example/image.jpg'), 'https://supplier.example/image.jpg');
  assert.equal(getProductImageUrl({ url: '/api/image/00123456', ean: '00123456' }), lookup('00123456'));
  assert.equal(getProductImageUrl('{"url":"/images/00123456.jpg"}'), `${base}/images/00123456.jpg`);
  assert.equal(getProductImageUrl({ filename: 'a product.png' }), `${base}/images/a%20product.png`);
  assert.equal(getProductImageUrl({ uri: 'file:///camera/image.jpg' }), 'file:///camera/image.jpg');
  assert.equal(getProductImageUrl(`http://${new URL(base).host}/images/test.jpg`), `${base}/images/test.jpg`);
});

test('missing and malformed image metadata still tries the product barcode without throwing', () => {
  for (const img of [null, undefined, '', ' ', 'null', 'N/A', 'undefined', '{broken json', [], 42, { url: 12 }]) {
    assert.deepEqual(getProductImageCandidates(img, ' 00123456 '), [lookup('00123456')], String(img));
  }
  assert.deepEqual(getProductImageCandidates(null), []);
  assert.equal(getProductImageUrl(null, 'null'), null);
  assert.equal(getProductImageUrl(null, '../private'), null);
  assert.equal(getProductImageUrl(null, 'ABC #12'), lookup('ABC%20%2312'));
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://', 'https://user:password@example.com/a.jpg']) {
    assert.deepEqual(getProductImageCandidates(url), []);
  }
});

test('supplier image failure can recover via locally stored EAN and product barcode without retry loops', () => {
  assert.deepEqual(getProductImageCandidates({ url: 'https://supplier.example/photo.jpg', ean: '1234' }, '5678'), [
    'https://supplier.example/photo.jpg', lookup('1234'), lookup('5678'),
  ]);
  assert.deepEqual(getProductImageCandidates({ url: '/api/image/1234', ean: '1234' }, '1234'), [lookup('1234')]);
});

test('camera/library image schemes used by label editors remain local', () => {
  for (const uri of ['file:///photo.jpg', 'content://media/1234', 'blob:https://app.example/1234', 'data:image/png;base64,aGVsbG8=', 'ph://1234']) {
    assert.equal(getProductImageUrl(uri), uri);
  }
});

// Exercise component callbacks with a mocked native Image and hook store. No device/network
// is involved; native decoding and actual camera behavior remain device smoke-test checks.
function imageHarness() {
  let state = [];
  let cursor = 0;
  let key;
  const logo = 77;
  const fakeReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
  };
  const source = readFileSync(new URL('../src/components/ui/product-image.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react') return fakeReact;
      if (name === 'expo-image') return { Image: 'NativeImage' };
      if (name === 'react-native') return { Pressable: 'NativePressable', StyleSheet: { absoluteFill: { position: 'absolute' } } };
      if (name === '@/utils/product-image') return { getProductImageCandidates };
      if (name === '@/assets/images/icon.png') return logo;
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return {
    logo,
    render(props) {
      const request = module.exports.ProductImage(props);
      if (key !== request.key) { state = []; key = request.key; }
      cursor = 0;
      const view = request.type(request.props);
      return { view, image: view.type === 'NativePressable' ? view.props.children : view };
    },
  };
}

test('404/decode errors progress to barcode then the bundled logo, with placeholder during every load', () => {
  const harness = imageHarness();
  const props = { img: 'https://supplier.example/missing.jpg', barcode: '1234' };
  let { image } = harness.render(props);
  assert.equal(image.props.source.uri, props.img);
  assert.equal(image.props.placeholder, harness.logo);
  image.props.onError();
  ({ image } = harness.render(props));
  assert.equal(image.props.source.uri, lookup('1234'));
  image.props.onError();
  ({ image } = harness.render(props));
  assert.equal(image.props.source, harness.logo);
  assert.match(image.props.accessibilityLabel, /unavailable/);
  image.props.onError();
  assert.equal(harness.render(props).image.props.source, harness.logo, 'local fallback failure never creates a retry loop');
  assert.equal(imageHarness().render({}).image.props.source, harness.logo);
});

test('preview waits for a loaded photo and uses the successful fallback URI', () => {
  const harness = imageHarness();
  const previewed = [];
  const props = { img: '/missing.jpg', barcode: '1234', onPreview: (uri) => previewed.push(uri) };
  let { view, image } = harness.render(props);
  assert.equal(view.props.disabled, true);
  image.props.onError();
  ({ view, image } = harness.render(props));
  assert.equal(view.props.disabled, true);
  image.props.onLoad();
  ({ view } = harness.render(props));
  assert.equal(view.props.disabled, false);
  let stopped = false;
  view.props.onPress({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.deepEqual(previewed, [lookup('1234')]);
});

test('late events from a failed source cannot skip a fallback or enable the wrong preview', () => {
  const harness = imageHarness();
  const props = { img: '/missing.jpg', barcode: '1234', onPreview() {} };
  const oldImage = harness.render(props).image;
  oldImage.props.onError();
  oldImage.props.onError();
  oldImage.props.onLoad();
  let next = harness.render(props);
  assert.equal(next.image.props.source.uri, lookup('1234'));
  assert.equal(next.view.props.disabled, true);
  next.image.props.onLoad();
  oldImage.props.onError();
  next = harness.render(props);
  assert.equal(next.image.props.source.uri, lookup('1234'));
  assert.equal(next.view.props.disabled, false);
});

test('recycled rows reset failures and preview availability when the product source changes', () => {
  const harness = imageHarness();
  const props = { img: '/old.jpg', onPreview() {} };
  harness.render(props).image.props.onError();
  assert.equal(harness.render(props).image.props.source, harness.logo);
  const next = harness.render({ ...props, img: '/new.jpg' });
  assert.equal(next.image.props.source.uri, `${base}/new.jpg`);
  assert.equal(next.view.props.disabled, true);
  next.image.props.onLoad();
  assert.equal(harness.render({ ...props, img: '/new.jpg' }).view.props.disabled, false);
  const empty = harness.render({ ...props, img: null });
  assert.equal(empty.view.props.disabled, true);
  assert.equal(empty.image.props.source, harness.logo);
});
