// Batch 5 verification: catalogue T01–T19 — exact text/order/sections/sizes,
// real-product rendering per template, pricing rules and layout safety.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch5-check.mjs
import assert from 'node:assert/strict';

import { applyLookupResult, createPendingItem, setPriceText } from '../src/features/labels/model/label-item.ts';
import { TEMPLATE_FIELDS, TEMPLATE_ICONS } from '../src/features/labels/registry/catalogue-meta.ts';
import { TEMPLATES } from '../src/features/labels/registry/manifest.ts';
import { LABEL_SIZES, mmToPt } from '../src/features/labels/registry/sizes.ts';
import { renderTalker, TALKER_FIXTURE, TALKER_TEMPLATE_IDS } from '../src/features/labels/render/shelf-talkers.ts';
import { itemToTalkerContent, readTalkerSettings } from '../src/features/labels/render/talker-settings.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

// Transcribed from the spec §7 tables and R08–R12 screenshots.
const REFERENCE = [
  ['T01', 'Shelf label · 203 × 75 mm', 'WOW Red · Shelf', '203 × 75 mm · WOW badge + price + product photo'],
  ['T02', 'Shelf label · 203 × 75 mm', 'Special Offer · Shelf', '203 × 75 mm · Red banner + bold price + photo'],
  ['T03', 'Shelf label · 203 × 75 mm', 'Limited Time · Shelf', '203 × 75 mm · Yellow background · image right, text left'],
  ['T04', 'Alcohol · 7 × 7 cm', 'Black Label · 7 × 7 cm', '70 × 70 mm · Bold underlined name + big red £'],
  ['T05', 'Alcohol · 7 × 7 cm', 'WOW · 7 × 7 cm', '70 × 70 mm · Red WOW disc with price + product caption'],
  ['T06', 'Alcohol · 7 × 7 cm', 'Was / Now · 7 × 7 cm', '70 × 70 mm · Was → Now'],
  ['T07', 'Alcohol · 7 × 7 cm', 'Multi-buy · 7 × 7 cm', '70 × 70 mm · Yellow · "X for £Y" + product list'],
  ['T08', 'Shelf · 8 × 3 in', 'Side Panel · 8 × 3 in', '203 × 76 mm · Product left · red offer panel right'],
  ['T09', 'Shelf · 8 × 3 in', 'WOW · 8 × 3 in', '203 × 76 mm · WOW circle + name + photo'],
  ['T10', 'Shelf · 8 × 3 in', 'Was / Now · 8 × 3 in', '203 × 76 mm · Big strikethrough was → now'],
  ['T11', 'Shelf · 8 × 3 in', 'Multi-buy · 8 × 3 in', '203 × 76 mm · Yellow · "X for £Y" + photo + product list'],
  ['T12', 'Shelf · 6 × 3 in', 'Red Banner · 6 × 3 in', '152 × 76 mm · "X for £Y" banner + each-price'],
  ['T13', 'Shelf · 6 × 3 in', 'WOW · 6 × 3 in', '152 × 76 mm · WOW circle + price + product'],
  ['T14', 'Shelf · 6 × 3 in', 'Was / Now · 6 × 3 in', '152 × 76 mm · Big strikethrough "was" → "now"'],
  ['T15', 'Shelf · 6 × 3 in', 'Multi-buy · 6 × 3 in', '152 × 76 mm · Yellow · "X for £Y" + product list'],
  ['T16', 'Shelf · 4 × 3 in', 'Circle Badge · 4 × 3 in', '102 × 76 mm · Big red circle + product line'],
  ['T17', 'Shelf · 4 × 3 in', 'WOW · 4 × 3 in', '102 × 76 mm · WOW circle on left · name + price right'],
  ['T18', 'Shelf · 4 × 3 in', 'Was / Now · 4 × 3 in', '102 × 76 mm · Compact was → now'],
  ['T19', 'Shelf · 4 × 3 in', 'Multi-buy · 4 × 3 in', '102 × 76 mm · Yellow · "X for £Y" headline'],
];

const EXPECTED_MM = { SHELF_GB: [203, 75], ALCOHOL_SQUARE: [70, 70], SHELF_8X3: [203.2, 76.2], SHELF_6X3: [152.4, 76.2], SHELF_4X3: [101.6, 76.2] };
// Circle Badge (R08) prints "OFFER" + product line only — no price by design.
const PRICED = REFERENCE.map((r) => r[0]).filter((id) => id !== 'T16');
const texts = (c) => c.nodes.filter((n) => n.kind === 'text').flatMap((n) => n.lines);
const inked = (c) => c.nodes.filter((n) => !n.previewOnly);

check('All 19 templates present in exact reference order with exact section/title/subtitle', () => {
  const actual = TEMPLATES.slice(0, 19).map((t) => [t.id, t.section, t.title, t.subtitle]);
  assert.deepEqual(actual, REFERENCE);
  assert.deepEqual(TALKER_TEMPLATE_IDS, REFERENCE.map((r) => r[0]));
});

check('Sections appear in reference order (GB shelf, Alcohol, 8×3, 6×3, 4×3)', () => {
  const order = [...new Set(TEMPLATES.slice(0, 19).map((t) => t.section))];
  assert.deepEqual(order, ['Shelf label · 203 × 75 mm', 'Alcohol · 7 × 7 cm', 'Shelf · 8 × 3 in', 'Shelf · 6 × 3 in', 'Shelf · 4 × 3 in']);
});

check('Exact physical sizes: inch families stay 203.2/152.4/101.6 × 76.2 mm (not the rounded catalogue text)', () => {
  for (const t of TEMPLATES.slice(0, 19)) {
    const c = renderTalker(t.id, TALKER_FIXTURE);
    assert.deepEqual([c.widthMm, c.heightMm], EXPECTED_MM[t.sizeId], t.id);
  }
  assert.ok(Math.abs(mmToPt(LABEL_SIZES.SHELF_8X3.widthMm) - 576) < 1e-9, '8 in = 576 pt');
});

check('203 × 75 GB family is distinct from the 8 × 3 in family', () => {
  assert.notEqual(renderTalker('T01', TALKER_FIXTURE).heightMm, renderTalker('T09', TALKER_FIXTURE).heightMm);
});

check('Every template has an icon category and field spec', () => {
  for (const [id] of REFERENCE) {
    assert.ok(TEMPLATE_ICONS[id], `${id} icon`);
    assert.ok(TEMPLATE_FIELDS[id], `${id} fields`);
  }
  assert.equal(TEMPLATE_ICONS.T01.icon, 'lightning-bolt');
  assert.equal(TEMPLATE_ICONS.T06.icon, 'arrow-collapse-horizontal');
  assert.equal(TEMPLATE_ICONS.T07.icon, 'glass-cocktail');
  assert.equal(TEMPLATE_ICONS.T03.icon, 'timer-outline');
  assert.equal(TEMPLATE_ICONS.T16.icon, 'record-circle-outline');
});

check('Fixture thumbnails: £1.99 (priced designs) and Sample product on every design; no warnings', () => {
  for (const [id] of REFERENCE) {
    const c = renderTalker(id, TALKER_FIXTURE);
    const all = texts(c).join(' | ');
    if (PRICED.includes(id)) assert.ok(/£1\.99/.test(all), `${id} price`);
    assert.ok(/SAMPLE PRODUCT|Sample product|Sample/.test(all), `${id} name`);
    assert.equal(c.warnings.length, 0, `${id}: ${c.warnings.join('; ')}`);
  }
});

check('Reference-specific fixture text: Multi-buy "OFFER £1.99", Circle Badge "ON SAMPLE PRODUCT"', () => {
  for (const id of ['T11', 'T15', 'T19']) assert.ok(texts(renderTalker(id, TALKER_FIXTURE)).includes('OFFER £1.99'), id);
  assert.deepEqual(texts(renderTalker('T07', TALKER_FIXTURE)).slice(0, 2), ['OFFER', '£1.99']);
  assert.ok(texts(renderTalker('T16', TALKER_FIXTURE)).includes('ON SAMPLE PRODUCT'));
  assert.ok(texts(renderTalker('T08', TALKER_FIXTURE)).includes('each'));
});

check('Black Label underlines the name; price is red', () => {
  const c = renderTalker('T04', TALKER_FIXTURE);
  const name = c.nodes.find((n) => n.kind === 'text' && n.lines.join(' ') === 'Sample product');
  assert.ok(name.underline);
  assert.equal(c.nodes.find((n) => n.kind === 'text' && n.lines[0] === '£1.99').colour, '#F44236');
});

// ---- A real edited product per family (catalogue RRP, then owner price) ----
function realItem() {
  let item = applyLookupResult(createPendingItem('5010511482313'), {
    id: 'p1',
    title: 'Barratt Fruit Salad Duo',
    retailSize: '120G',
    rrp: '1.15',
  });
  item = { ...item, snapshot: { ...item.snapshot, brand: 'Barratt' } };
  return setPriceText(item, '0.99');
}
const settings = readTalkerSettings({});

check('Real edited product renders on all 19 designs with the owner price, never the RRP', () => {
  const content = itemToTalkerContent(realItem(), settings);
  for (const [id] of REFERENCE) {
    const all = texts(renderTalker(id, content)).join(' | ');
    if (PRICED.includes(id)) assert.ok(/£0\.99/.test(all), `${id} shows £0.99`);
    assert.equal(/£1\.15/.test(all), false, `${id} must not print the RRP`);
    assert.ok(/BARRATT FRUIT SALAD DUO|Barratt Fruit Salad Duo|Barratt/.test(all), `${id} name`);
  }
});

check('No photo on a real product → photo designs collapse; no sample bottle substituted', () => {
  const content = itemToTalkerContent(realItem(), settings);
  for (const id of ['T01', 'T02', 'T03', 'T09', 'T11', 'T13']) {
    const c = renderTalker(id, content);
    assert.equal(c.nodes.some((n) => n.kind === 'rect' && n.fill === '#FBEADF'), false, `${id} fixture backdrop`);
    assert.equal(c.nodes.some((n) => n.kind === 'image'), false, id);
  }
});

check('Real photo → image node (contain), never stretched outside its box', () => {
  const item = realItem();
  const content = itemToTalkerContent({ ...item, snapshot: { ...item.snapshot, imageUri: 'file:///photo.jpg' } }, settings);
  for (const id of ['T01', 'T02', 'T03', 'T09', 'T11', 'T13']) {
    const c = renderTalker(id, content);
    const img = c.nodes.find((n) => n.kind === 'image');
    assert.ok(img, id);
    assert.ok(img.xMm + img.wMm <= c.widthMm && img.yMm + img.hMm <= c.heightMm, `${id} inside`);
  }
});

check('Missing price → preview-only marker, never inked as £0.00', () => {
  let item = applyLookupResult(createPendingItem('5060116211443'), { id: 'p2', title: 'Tuscan Chicken Soup', rrp: null });
  const content = itemToTalkerContent(item, settings);
  for (const id of PRICED) {
    const c = renderTalker(id, content);
    assert.equal(JSON.stringify(inked(c)).includes('£0.00'), false, id);
    assert.ok(c.nodes.some((n) => n.previewOnly && n.lines?.[0] === 'Needs price'), `${id} marker`);
  }
});

check('Multi-buy values kept separate: 2 FOR £16 headline, each £8.75 elsewhere, Was not from RRP', () => {
  let item = setPriceText(realItem(), '8.75');
  item = { ...item, offerQuantityText: '2', offerTotalText: '16', wasText: '11.25' };
  const content = itemToTalkerContent(item, settings);
  for (const id of ['T11', 'T15', 'T19']) assert.ok(texts(renderTalker(id, content)).includes('2 FOR £16'), id);
  assert.deepEqual(texts(renderTalker('T07', content)).slice(0, 2), ['2 FOR', '£16']);
  assert.ok(texts(renderTalker('T12', content)).includes('2 FOR £16'), 'Red Banner shows X for £Y');
  assert.ok(texts(renderTalker('T08', content)).includes('2 FOR £16'), 'Side panel offer');
  const wasNow = renderTalker('T14', content);
  assert.ok(wasNow.nodes.find((n) => n.kind === 'text' && n.lines[0] === '£11.25')?.strike);
  assert.ok(texts(wasNow).includes('£8.75'));
});

check('Badge text override replaces the default headline only where the design prints one', () => {
  const content = itemToTalkerContent(realItem(), { ...settings, headline: 'Half price' });
  assert.ok(texts(renderTalker('T02', content)).includes('HALF PRICE'));
  assert.ok(texts(renderTalker('T16', content)).includes('HALF PRICE'));
  assert.equal(texts(renderTalker('T04', content)).includes('HALF PRICE'), false, 'Black Label has no badge');
});

check('Small print is printed only when the owner provides it', () => {
  const none = renderTalker('T01', itemToTalkerContent(realItem(), settings));
  assert.equal(none.nodes.some((n) => n.kind === 'rect' && n.fill === '#D9DADE'), false, 'no placeholder line on real labels');
  const withFooter = renderTalker('T01', itemToTalkerContent(realItem(), { ...settings, footer: 'While stocks last' }));
  assert.ok(texts(withFooter).includes('While stocks last'));
});

check('Long names are reported, not ellipsised, on every design', () => {
  const item = realItem();
  const long = { ...item, snapshot: { ...item.snapshot, displayName: 'Extraordinarily Long Premium Assorted Fruit Flavour Chewy Sweets Sharing Bag Limited Edition Mega Size Multipack With Extra Free Sweets Inside Every Single Bag For The Whole Family To Share This Summer Season Only' } };
  const content = itemToTalkerContent(long, settings);
  for (const [id] of REFERENCE) {
    const c = renderTalker(id, content);
    assert.ok(c.warnings.some((w) => /too long/.test(w)), `${id} should warn`);
    assert.equal(texts(c).some((l) => l.includes('…')), false, `${id} no ellipsis`);
  }
});

check('All nodes stay inside the physical label on every design (fixture + real)', () => {
  for (const content of [TALKER_FIXTURE, itemToTalkerContent(realItem(), settings)]) {
    for (const [id] of REFERENCE) {
      const c = renderTalker(id, content);
      for (const n of c.nodes.filter((x) => 'wMm' in x && x.kind !== 'text')) {
        assert.ok(n.xMm >= -0.01 && n.xMm + n.wMm <= c.widthMm + 0.01, `${id} ${n.kind} x`);
        assert.ok(n.yMm >= -0.01 && n.yMm + (n.hMm ?? 0) <= c.heightMm + 0.01, `${id} ${n.kind} y`);
      }
    }
  }
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
