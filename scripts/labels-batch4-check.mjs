// Batch 4 verification: reduced stickers — sizes/dots, empty state, designs,
// colours, barcode integrity, print gating and the roll-label PDF page size.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch4-check.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inferCustomCode } from '../src/features/labels/model/barcode.ts';
import { createCustomItem, createPendingItem, setPriceText, applyLookupResult } from '../src/features/labels/model/label-item.ts';
import { mmToPt } from '../src/features/labels/registry/sizes.ts';
import { compositionToSvg } from '../src/features/labels/render/composition-svg.ts';
import { renderSticker, STICKER_FIXTURE } from '../src/features/labels/render/reduced-sticker.ts';
import {
  dotsText,
  itemToStickerContent,
  readStickerSettings,
  STICKER_PRESETS,
  validateCustomSize,
  validateSticker,
} from '../src/features/labels/render/sticker-settings.ts';

import { buildRollLabelHtml } from '../src/features/labels/export/roll-label-html.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

const OPTS = { widthMm: 50, heightMm: 30, background: 'none', textColour: 'black' };
const kinds = (c, kind) => c.nodes.filter((n) => n.kind === kind);
const inked = (c) => c.nodes.filter((n) => !n.previewOnly);
const texts = (c) => kinds(c, 'text').flatMap((t) => t.lines);

check('Label size presets match R15 text exactly at 203 dpi', () => {
  const lines = STICKER_PRESETS.map((p) => `${p.note ? `${p.note} · ` : ''}${dotsText(p.widthMm, p.heightMm, 203)}`);
  assert.deepEqual(lines, [
    'Most common · 400 × 240 dots at 203 dpi',
    '400 × 200 dots at 203 dpi',
    '320 × 240 dots at 203 dpi',
    'Portrait · 240 × 400 dots at 203 dpi',
  ]);
});

check('Dots are recalculated from printer resolution (not fixed to 203)', () => {
  assert.equal(dotsText(50, 30, 300), '591 × 354 dots at 300 dpi');
  assert.equal(dotsText(50, 30, 203), '400 × 240 dots at 203 dpi');
});

check('Custom size validation: positive, within printer bounds', () => {
  assert.equal(validateCustomSize(62, 29), null);
  assert.ok(validateCustomSize(0, 30));
  assert.ok(validateCustomSize(150, 30), 'wider than a 104 mm print head');
  assert.ok(validateCustomSize(NaN, 30));
});

check('Defaults: 50 × 30, Reduced, background None, text Black, title REDUCED, date off', () => {
  const s = readStickerSettings({});
  assert.deepEqual(
    [s.widthMm, s.heightMm, s.design, s.background, s.textColour, s.title, s.printDate, s.currency],
    [50, 30, 'reduced', 'none', 'black', 'REDUCED', false, 'GBP'],
  );
});

check('Empty Reduced preview = only REDUCED + £0.00; no invented barcode or Was', () => {
  const c = renderSticker('reduced', itemToStickerContent(createCustomItem(), 'REDUCED'), OPTS);
  assert.deepEqual(texts(c), ['REDUCED', '£0.00']);
  assert.equal(kinds(c, 'barcode').length, 0);
  assert.equal(kinds(c, 'rect').length, 0, 'None background draws no fill');
});

check('£0.00 placeholder is preview-only and printing is blocked', () => {
  const item = createCustomItem();
  const c = renderSticker('reduced', itemToStickerContent(item, 'REDUCED'), OPTS);
  assert.equal(JSON.stringify(inked(c)).includes('£0.00'), false);
  assert.equal(validateSticker(item).price, 'Add a price to print.');
});

check('Fixture Reduced: barcode, struck Was £13.69, NOW £7.99', () => {
  const c = renderSticker('reduced', STICKER_FIXTURE, OPTS);
  const all = kinds(c, 'text');
  assert.ok(all.find((t) => t.lines[0] === 'Was £13.69')?.strike);
  assert.ok(all.some((t) => t.lines[0] === 'NOW'));
  assert.ok(all.some((t) => t.lines[0] === '£7.99'));
  assert.equal(kinds(c, 'barcode').length, 1);
});

check('Was / Now: PRODUCT NAME, WAS/NOW captions, barcode along the bottom', () => {
  const c = renderSticker('was_now', STICKER_FIXTURE, OPTS);
  const t = texts(c);
  for (const expected of ['PRODUCT NAME', 'WAS', 'NOW', '£13.69', '£7.99']) assert.ok(t.includes(expected), expected);
  const bar = kinds(c, 'barcode')[0];
  const price = kinds(c, 'text').find((n) => n.lines[0] === '£7.99');
  assert.ok(bar.yMm > price.yMm, 'barcode below price');
});

check('Provisional Price design: name, large price, barcode, no Was', () => {
  const c = renderSticker('price', STICKER_FIXTURE, OPTS);
  const t = texts(c);
  assert.ok(t.includes('PRODUCT NAME') && t.includes('£7.99'));
  assert.equal(t.includes('£13.69'), false);
});

check('Missing optional fields collapse (no barcode → no barcode block)', () => {
  const c = renderSticker('was_now', { ...STICKER_FIXTURE, barcode: undefined, symbology: undefined, wasMinor: undefined }, OPTS);
  assert.equal(kinds(c, 'barcode').length, 0);
  assert.equal(texts(c).includes('WAS'), false);
});

check('Background None = no ink; White = explicit white; Yellow/Red keep a white barcode backing', () => {
  assert.equal(kinds(renderSticker('reduced', STICKER_FIXTURE, OPTS), 'rect').length, 0);
  assert.equal(kinds(renderSticker('reduced', STICKER_FIXTURE, { ...OPTS, background: 'white' }), 'rect')[0].fill, '#FFFFFF');
  for (const background of ['yellow', 'red']) {
    const rects = kinds(renderSticker('reduced', STICKER_FIXTURE, { ...OPTS, background }), 'rect');
    assert.equal(rects.length, 2, `${background}: fill + barcode backing`);
    assert.equal(rects[1].fill, '#FFFFFF');
  }
});

check('Red text colours artwork text; barcode bars and digits stay black', () => {
  const c = renderSticker('reduced', STICKER_FIXTURE, { ...OPTS, textColour: 'red' });
  const digits = kinds(c, 'text').find((t) => t.lines[0] === STICKER_FIXTURE.barcode);
  assert.equal(digits.colour, '#111111');
  assert.ok(kinds(c, 'text').filter((t) => t.lines[0] !== STICKER_FIXTURE.barcode).every((t) => t.colour === '#E53935'));
  assert.ok(compositionToSvg(c).includes('<g fill="#000"'), 'bars drawn black');
});

check('Print the date adds one small date line at the foot', () => {
  const c = renderSticker('reduced', STICKER_FIXTURE, { ...OPTS, dateText: '25/09/2026' });
  const date = kinds(c, 'text').find((t) => t.lines[0] === '25/09/2026');
  assert.ok(date && date.yMm > 25);
});

check('Every preset renders within its own physical size (portrait included)', () => {
  for (const p of STICKER_PRESETS) {
    const c = renderSticker('reduced', STICKER_FIXTURE, { ...OPTS, widthMm: p.widthMm, heightMm: p.heightMm });
    assert.equal(c.widthMm, p.widthMm);
    for (const n of c.nodes.filter((x) => 'wMm' in x)) {
      assert.ok(n.xMm >= -0.7 && n.xMm + n.wMm <= p.widthMm + 0.7, `${p.id} x overflow`);
    }
  }
});

check('Sticker price follows RRP rules: RRP prefill, owner edit wins', () => {
  let item = applyLookupResult(createPendingItem('5010511482313'), { id: 'x', title: 'Barratt', rrp: '1.15' });
  assert.equal(itemToStickerContent(item, 'REDUCED').priceMinor, 115);
  item = setPriceText(item, '0.59');
  item = applyLookupResult(item, { id: 'x', title: 'Barratt', rrp: '1.15' });
  assert.equal(itemToStickerContent(item, 'REDUCED').priceMinor, 59);
  assert.equal(itemToStickerContent(item, 'REDUCED').wasMinor, undefined, 'RRP never becomes Was');
});

check('Barcode field: own code inferred only when it cannot be retail; typos flagged', () => {
  assert.equal(inferCustomCode('SHOP-0042'), true);
  assert.equal(inferCustomCode('4471'), true);
  assert.equal(inferCustomCode('501051148231'), false, '12 digits stays retail (UPC-A path)');
  const typo = createCustomItem('5010511482314');
  assert.ok(validateSticker(setPriceText(typo, '1')).barcode, 'bad check digit is not silently accepted');
});

check('Copies must be a positive whole number', () => {
  const item = setPriceText(createCustomItem(), '1.00');
  assert.equal(validateSticker({ ...item, copies: 0 }).copies, 'Copies must be a whole number, 1 or more');
  assert.equal(Object.keys(validateSticker(item)).length, 0);
});

// ---- Real PDF from the exact HTML the app prints; measure MediaBox ----
const chromium = ['chromium', 'google-chrome'].find((bin) => {
  try {
    execFileSync('which', [bin]);
    return true;
  } catch {
    return false;
  }
});

function pdfMediaBoxes(file) {
  const raw = readFileSync(file, 'latin1');
  return [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [
    Number(m[3]) - Number(m[1]),
    Number(m[4]) - Number(m[2]),
  ]);
}

for (const [w, h, copies] of [[50, 30, 2], [30, 50, 1]]) {
  check(`Roll PDF ${w} × ${h} mm: MediaBox ≈ ${mmToPt(w).toFixed(3)} × ${mmToPt(h).toFixed(3)} pt, ${copies} page(s)`, () => {
    assert.ok(chromium, 'headless Chromium not found');
    const dir = mkdtempSync(join(tmpdir(), 'labels-pdf-'));
    const content = itemToStickerContent(setPriceText(createCustomItem('5000168001357'), '7.99'), 'REDUCED');
    const html = buildRollLabelHtml(renderSticker('reduced', content, { ...OPTS, widthMm: w, heightMm: h }), copies);
    writeFileSync(join(dir, 'label.html'), html);
    execFileSync(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(dir, 'label.pdf')}`, `file://${join(dir, 'label.html')}`], { stdio: 'ignore' });
    const boxes = pdfMediaBoxes(join(dir, 'label.pdf'));
    assert.equal(boxes.length, copies, `pages: ${boxes.length}`);
    for (const [bw, bh] of boxes) {
      assert.ok(Math.abs(bw - mmToPt(w)) < 1 && Math.abs(bh - mmToPt(h)) < 1, `got ${bw.toFixed(3)} × ${bh.toFixed(3)} pt`);
    }
  });
}

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
