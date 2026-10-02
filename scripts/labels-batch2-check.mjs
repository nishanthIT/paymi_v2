// Batch 2 data-entry verification for the Labels feature.
// Runs the real model code against live backend lookups.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch2-check.mjs
//   env: LABELS_API (default http://localhost:3000/api), LABELS_EMAIL, LABELS_PASSWORD
import assert from 'node:assert/strict';

import { checkBarcode } from '../src/features/labels/model/barcode.ts';
import { draftReducer, emptyDraft, labelInstanceCount, parseStoredDraft } from '../src/features/labels/model/draft.ts';
import {
  applyLookupResult,
  createCustomItem,
  createPendingItem,
  isOutputReady,
  needsPrice,
  priceSource,
  setPriceText,
  setRrpText,
  validateItem,
} from '../src/features/labels/model/label-item.ts';

const API = process.env.LABELS_API ?? 'http://localhost:3000/api';
const EMAIL = process.env.LABELS_EMAIL;
const PASSWORD = process.env.LABELS_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set LABELS_EMAIL and LABELS_PASSWORD for a local test account.');
  process.exit(2);
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = login.token ?? login.data?.token;
assert.ok(token, 'login failed');

async function lookup(barcode) {
  const res = await fetch(`${API}/products/barcode/${encodeURIComponent(barcode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  const body = await res.json();
  const p = body.data ?? body;
  return { id: p.id, title: p.title, barcode: p.barcode, retailSize: p.retailSize, rrp: p.rrp, imageUri: null };
}

const WITH_RRP = '5010511482313'; // catalogue RRP 1.15
const NO_RRP = '5060116211443'; // catalogue RRP null
const LEADING_ZERO = '072417337253'; // UPC-A with leading zero
const UNKNOWN = '5000000000005'; // valid EAN-13, not in catalogue

await check('Found with RRP → Price prefilled from RRP, source RRP kept separately', async () => {
  const item = applyLookupResult(createPendingItem(WITH_RRP), await lookup(WITH_RRP));
  assert.equal(item.lookup, 'found');
  assert.equal(item.priceText, '1.15');
  assert.equal(item.snapshot.sourceRrpMinor, 115);
  assert.equal(item.snapshot.sourceRrpCurrency, 'GBP');
  assert.equal(item.priceEdited, false);
  assert.equal(priceSource(item), 'catalogue_rrp');
  assert.equal(item.wasText, '', 'RRP must not become Was');
  assert.ok(isOutputReady(item));
});

await check('Found without RRP → details filled, Price blank, marked Needs price, blocked', async () => {
  const item = applyLookupResult(createPendingItem(NO_RRP), await lookup(NO_RRP));
  assert.equal(item.lookup, 'found');
  assert.ok(item.snapshot.displayName.length > 0);
  assert.equal(item.priceText, '');
  assert.equal(item.snapshot.sourceRrpMinor, undefined);
  assert.ok(needsPrice(item));
  assert.equal(validateItem(item).price, 'Enter the price for this label');
  assert.equal(isOutputReady(item), false);
});

await check('Unknown code → exact string kept, no price invented, can become custom', async () => {
  const result = await lookup(UNKNOWN);
  assert.equal(result, null);
  let item = applyLookupResult(createPendingItem(UNKNOWN), result);
  assert.equal(item.lookup, 'not_found');
  assert.equal(item.snapshot.barcode, UNKNOWN);
  assert.equal(item.priceText, '');
  item = { ...item, snapshot: { ...item.snapshot, displayName: 'Homemade flapjack', brand: 'Our bakery' } };
  item = setPriceText(item, '2.50');
  assert.ok(isOutputReady(item));
});

await check('Leading-zero barcode preserved exactly (UPC-A)', async () => {
  const item = applyLookupResult(createPendingItem(LEADING_ZERO), await lookup(LEADING_ZERO));
  assert.equal(item.snapshot.barcode, LEADING_ZERO);
  assert.equal(item.snapshot.barcodeSymbology, 'UPCA');
});

await check('Manually edited price survives a later lookup refresh', async () => {
  const product = await lookup(WITH_RRP);
  let item = applyLookupResult(createPendingItem(WITH_RRP), product);
  item = setPriceText(item, '0.99');
  item = applyLookupResult(item, product); // refresh / reopen
  assert.equal(item.priceText, '0.99');
  assert.equal(priceSource(item), 'owner');
  assert.equal(item.snapshot.sourceRrpMinor, 115, 'source RRP still retained separately');
});

await check('Spec case 4: RRP 8.75 prefills £8.75; owner edits to £8.49; persists over refresh', () => {
  const fake = { id: 'x', title: 'Mud House Sauvignon Blanc', barcode: '5010511482313', retailSize: '75cl', rrp: '8.75' };
  let item = applyLookupResult(createPendingItem('5010511482313'), fake);
  assert.equal(item.priceText, '8.75');
  item = setPriceText(item, '8.49');
  item = applyLookupResult(item, fake);
  assert.equal(item.priceText, '8.49');
});

await check('Owner RRP prefills untouched Price, but never replaces an edited Price', () => {
  let a = createCustomItem();
  a = setRrpText(a, '3.49');
  assert.equal(a.priceText, '3.49');
  assert.equal(a.priceEdited, false);
  let b = setPriceText(createCustomItem(), '2.99');
  b = setRrpText(b, '3.49');
  assert.equal(b.priceText, '2.99');
  assert.equal(b.wasText, '', 'RRP never auto-fills Was');
});

await check('Promo values kept separate: was £11.25, each £8.75, 2 for £16', () => {
  let item = setPriceText(createCustomItem(), '8.75');
  item = { ...item, wasText: '11.25', offerQuantityText: '2', offerTotalText: '16', snapshot: { ...item.snapshot, displayName: 'Mud House' } };
  assert.deepEqual(validateItem(item), {});
  assert.equal(item.priceText, '8.75');
  assert.equal(item.wasText, '11.25');
  assert.equal(item.offerTotalText, '16');
});

await check('Blank / invalid prices are surfaced, never printed as £0.00', () => {
  const named = (i) => ({ ...i, snapshot: { ...i.snapshot, displayName: 'X' } });
  assert.ok(validateItem(named(createCustomItem())).price);
  assert.ok(validateItem(named(setPriceText(createCustomItem(), '0'))).price);
  assert.ok(validateItem(named(setPriceText(createCustomItem(), '1.2.3'))).price);
  assert.ok(validateItem(named(setPriceText(createCustomItem(), '1.999'))).price);
});

await check('Barcode validation: check digits, lengths, explicit custom code only', () => {
  assert.equal(checkBarcode(WITH_RRP).kind, 'ok');
  assert.equal(checkBarcode('5010511482314').kind, 'error'); // bad check digit
  assert.equal(checkBarcode('96385074').kind, 'ok'); // EAN-8
  assert.equal(checkBarcode('ABC-123').kind, 'error'); // not silently reinterpreted
  assert.equal(checkBarcode('ABC-123', { customCode: true }).kind, 'ok');
});

await check('Repeated intentional scan adds a second facing (two rows, count 2)', async () => {
  let draft = emptyDraft('SEL_STANDARD');
  const a = createPendingItem(WITH_RRP);
  const b = createPendingItem(WITH_RRP);
  draft = draftReducer(draft, { type: 'scan', item: a });
  draft = draftReducer(draft, { type: 'scan', item: b });
  const product = await lookup(WITH_RRP);
  draft = draftReducer(draft, { type: 'lookupResolved', itemId: a.id, result: product });
  draft = draftReducer(draft, { type: 'lookupResolved', itemId: b.id, result: product });
  assert.equal(draft.items.length, 2);
  assert.equal(labelInstanceCount(draft), 2);
});

await check('Out-of-order lookups do not swap products or edits between rows', async () => {
  let draft = emptyDraft('SEL_STANDARD');
  const first = createPendingItem(NO_RRP);
  const second = createPendingItem(WITH_RRP);
  draft = draftReducer(draft, { type: 'scan', item: first });
  draft = draftReducer(draft, { type: 'scan', item: second });
  // Owner types a price on row 1 while its lookup is still in flight.
  draft = draftReducer(draft, { type: 'update', itemId: first.id, update: (i) => setPriceText(i, '1.75') });
  const [slow, fast] = await Promise.all([lookup(NO_RRP), lookup(WITH_RRP)]);
  draft = draftReducer(draft, { type: 'lookupResolved', itemId: second.id, result: fast }); // later scan resolves first
  draft = draftReducer(draft, { type: 'lookupResolved', itemId: first.id, result: slow });
  assert.equal(draft.items[0].snapshot.barcode, NO_RRP);
  assert.equal(draft.items[0].priceText, '1.75');
  assert.equal(draft.items[1].snapshot.barcode, WITH_RRP);
  assert.equal(draft.items[1].priceText, '1.15');
});

await check('Lookup error state is recorded on the row and is retryable', () => {
  let draft = emptyDraft('SEL_STANDARD');
  const item = createPendingItem(WITH_RRP);
  draft = draftReducer(draft, { type: 'scan', item });
  draft = draftReducer(draft, { type: 'lookupFailed', itemId: item.id, message: 'Network Error' });
  assert.equal(draft.items[0].lookup, 'error');
  assert.equal(draft.items[0].snapshot.barcode, WITH_RRP);
});

await check('Late response for a removed row is dropped', () => {
  let draft = emptyDraft('SEL_STANDARD');
  const item = createPendingItem(WITH_RRP);
  draft = draftReducer(draft, { type: 'scan', item });
  draft = draftReducer(draft, { type: 'remove', itemId: item.id });
  draft = draftReducer(draft, { type: 'lookupResolved', itemId: item.id, result: { id: 'p', title: 'x' } });
  assert.equal(draft.items.length, 0);
});

await check('Draft persists round-trip; interrupted lookups become retryable', () => {
  let draft = emptyDraft('SEL_STANDARD');
  const done = setPriceText(createCustomItem('5010511482313'), '4.20');
  const pending = createPendingItem(NO_RRP);
  draft = draftReducer(draft, { type: 'addCustom', item: done });
  draft = draftReducer(draft, { type: 'scan', item: pending });
  const restored = parseStoredDraft(JSON.stringify(draft), 'SEL_STANDARD');
  assert.equal(restored.items[0].priceText, '4.20');
  assert.equal(restored.items[0].priceEdited, true);
  assert.equal(restored.items[1].lookup, 'error');
  assert.equal(parseStoredDraft(JSON.stringify(draft), 'SEL_PROMO'), null, 'other tool drafts not loaded');
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
