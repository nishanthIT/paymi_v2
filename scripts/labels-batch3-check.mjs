// Batch 3 verification: sheet geometry, Start at/pagination, option effects on
// artwork, promo values, missing-price handling and barcode decodability.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch3-check.mjs
import assert from 'node:assert/strict';

import { STANDARD_SHELF_SHEET as SHEET } from '../src/features/labels/registry/sizes.ts';
import { cellRect, expandInstances, paginate } from '../src/features/labels/render/sheet-layout.ts';
import { FIXTURE_PROMO, FIXTURE_STANDARD, renderShelfLabel } from '../src/features/labels/render/shelf-label.ts';
import { encodeBarcode } from '../src/features/labels/render/barcode-encode.ts';
import { itemToShelfContent } from '../src/features/labels/render/shelf-settings.ts';
import { createPendingItem, setPriceText } from '../src/features/labels/model/label-item.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

const BASE = { penceSameSize: false, priceOnRight: true, barcodeDownSide: false, widthRatio: 1, colouredStock: false };
const nodes = (c, kind) => c.nodes.filter((n) => n.kind === kind);
const inked = (c) => c.nodes.filter((n) => !n.previewOnly);
const approx = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

// ---- Independent EAN-13 / UPC-A decoder (GS1 tables, not jsbarcode) ----
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((p) => p.replace(/./g, (b) => (b === '1' ? '0' : '1')));
const G = R.map((p) => p.split('').reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function decodeEan13(modules) {
  const start = modules.indexOf('101');
  let pos = start + 3;
  let parity = '';
  let left = '';
  for (let i = 0; i < 6; i++, pos += 7) {
    const chunk = modules.slice(pos, pos + 7);
    const l = L.indexOf(chunk);
    const g = G.indexOf(chunk);
    if (l >= 0) { left += l; parity += 'L'; } else if (g >= 0) { left += g; parity += 'G'; } else throw new Error(`bad left symbol at ${i}`);
  }
  if (modules.slice(pos, pos + 5) !== '01010') throw new Error('centre guard missing');
  pos += 5;
  let right = '';
  for (let i = 0; i < 6; i++, pos += 7) {
    const r = R.indexOf(modules.slice(pos, pos + 7));
    if (r < 0) throw new Error(`bad right symbol at ${i}`);
    right += r;
  }
  if (modules.slice(pos, pos + 3) !== '101') throw new Error('end guard missing');
  const first = PARITY.indexOf(parity);
  if (first < 0) throw new Error('bad parity');
  const code = `${first}${left}${right}`;
  const digits = code.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== digits[12]) throw new Error('check digit mismatch');
  return code;
}

check('A4 geometry: 3 × 7 cells of 70 × 38 mm, full width, 15.5 mm top/bottom', () => {
  assert.equal(SHEET.columns * SHEET.cell.widthMm, 210);
  const last = cellRect(SHEET, 21);
  assert.deepEqual([last.row, last.col], [7, 3], 'cell 21 is row 7 column 3');
  approx(last.xMm, 140, 'cell 21 x');
  approx(last.yMm, 243.5, 'cell 21 y');
  approx(SHEET.page.heightMm - (last.yMm + last.hMm), 15.5, 'bottom margin');
  approx(cellRect(SHEET, 1).yMm, 15.5, 'top margin');
});

check('Start at 21 with two copies → two sheets: cell 21, then cell 1', () => {
  const pages = paginate(expandInstances([{ id: 'a', copies: 2 }]), 21, SHEET);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].map((c, i) => (c ? i + 1 : null)).filter(Boolean), [21]);
  assert.deepEqual(pages[1].map((c, i) => (c ? i + 1 : null)).filter(Boolean), [1]);
  assert.equal(pages[0].slice(0, 20).every((c) => c === null), true, 'cells 1–20 get nothing');
});

check('Start at 1 with 22 instances → 21 labels then one', () => {
  const pages = paginate(expandInstances([{ id: 'a', copies: 10 }, { id: 'b', copies: 12 }]), 1, SHEET);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].filter(Boolean).length, 21);
  assert.equal(pages[1].filter(Boolean).length, 1);
  assert.equal(pages[0][9].itemId, 'a');
  assert.equal(pages[0][10].itemId, 'b', 'order preserved left→right, top→bottom');
});

check('Zero products → no instances on the sheet (fixture is preview-only)', () => {
  const pages = paginate(expandInstances([]), 21, SHEET);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].every((c) => c === null), true);
});

check('Standard default: name top, barcode left, raised pence price right', () => {
  const c = renderShelfLabel('standard', FIXTURE_STANDARD, BASE);
  const price = nodes(c, 'price')[0];
  const bar = nodes(c, 'barcode')[0];
  assert.equal(price.major, '£8.');
  assert.equal(price.minor, '75');
  assert.ok(bar.xMm < price.xMm, 'barcode left of price');
  assert.equal(c.warnings.length, 0);
});

check('Pence the same size → flat £8.75', () => {
  const price = nodes(renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, penceSameSize: true }), 'price')[0];
  assert.equal(price.major, '£8.75');
  assert.equal(price.minor, '');
});

check('Price on the right off → barcode and price swap sides', () => {
  const on = renderShelfLabel('standard', FIXTURE_STANDARD, BASE);
  const off = renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, priceOnRight: false });
  assert.ok(nodes(on, 'barcode')[0].xMm < nodes(on, 'price')[0].xMm);
  assert.ok(nodes(off, 'barcode')[0].xMm > nodes(off, 'price')[0].xMm);
});

check('Barcode down the side → upright barcode, longer bars, still decodes', () => {
  const flat = nodes(renderShelfLabel('standard', FIXTURE_STANDARD, BASE), 'barcode')[0];
  const up = nodes(renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, barcodeDownSide: true }), 'barcode')[0];
  assert.equal(up.rotated, true);
  assert.ok(up.wMm > flat.hMm, `upright bar length ${up.wMm} > flat bar length ${flat.hMm}`);
  assert.equal(decodeEan13(up.modules), FIXTURE_STANDARD.barcode);
});

check('Barcode down the side is ignored by Tobacco and Promo designs', () => {
  for (const design of ['tobacco', 'half_yellow', 'full_yellow']) {
    const c = renderShelfLabel(design, design === 'tobacco' ? FIXTURE_STANDARD : FIXTURE_PROMO, { ...BASE, barcodeDownSide: true });
    assert.equal(nodes(c, 'barcode').some((b) => b.rotated), false, design);
  }
});

check('Print the date → one small date line at the foot', () => {
  const c = renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, dateText: '25/09/2026' });
  const date = nodes(c, 'text').filter((t) => t.lines[0] === '25/09/2026');
  assert.equal(date.length, 1);
  assert.ok(date[0].yMm > 32, 'at the foot');
});

check('Width control narrows content inside the same 70 × 38 mm cell', () => {
  const full = renderShelfLabel('standard', FIXTURE_STANDARD, BASE);
  const narrow = renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, widthRatio: 0.78 });
  assert.equal(narrow.widthMm, 70);
  assert.equal(narrow.heightMm, 38);
  const span = (c) => {
    const boxes = c.nodes.filter((n) => 'wMm' in n);
    return Math.max(...boxes.map((n) => n.xMm + n.wMm)) - Math.min(...boxes.map((n) => n.xMm));
  };
  assert.ok(span(narrow) < span(full) - 10, `${span(narrow)} vs ${span(full)}`);
});

check('Too-narrow width is rejected with a barcode warning, not squeezed silently', () => {
  assert.equal(renderShelfLabel('standard', FIXTURE_STANDARD, BASE).warnings.length, 0);
  assert.ok(renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, widthRatio: 0.6 }).warnings.some((w) => /Barcode/.test(w)));
});

check('Tobacco: yellow-highlighted barcode, noticeably smaller price', () => {
  const std = nodes(renderShelfLabel('standard', FIXTURE_STANDARD, BASE), 'price')[0];
  const tob = renderShelfLabel('tobacco', FIXTURE_STANDARD, BASE);
  assert.ok(nodes(tob, 'price')[0].fontMm < std.fontMm * 0.7);
  assert.ok(nodes(tob, 'rect').some((r) => r.fill === '#F6DA3B'), 'highlight behind barcode');
});

check('Promo fixture keeps was £11.25, each £8.75, 2 FOR £16 separately', () => {
  const c = renderShelfLabel('half_yellow', FIXTURE_PROMO, BASE);
  const texts = nodes(c, 'text');
  const was = texts.find((t) => t.lines[0] === '£11.25');
  assert.ok(was?.strike, 'was is struck through');
  assert.ok(texts.some((t) => t.lines[0] === 'Each £8.75'));
  assert.ok(texts.some((t) => t.lines.join('|') === '2 FOR|£16'));
});

check('Full yellow fills the whole label; Half yellow only the right panel', () => {
  const full = nodes(renderShelfLabel('full_yellow', FIXTURE_PROMO, BASE), 'rect')[0];
  const half = nodes(renderShelfLabel('half_yellow', FIXTURE_PROMO, BASE), 'rect')[0];
  assert.deepEqual([full.xMm, full.wMm], [0, 70]);
  assert.ok(half.xMm > 30 && half.xMm + half.wMm === 70);
});

check('Pre-coloured stock: yellow is simulated in preview but never inked', () => {
  const c = renderShelfLabel('full_yellow', FIXTURE_PROMO, { ...BASE, colouredStock: true });
  assert.equal(inked(c).some((n) => n.kind === 'rect' && n.fill === '#F6DA3B'), false);
  assert.equal(c.nodes.some((n) => n.kind === 'rect' && n.previewOnly), true);
});

check('Missing price is never inked as £0.00 (preview-only marker)', () => {
  const item = { ...createPendingItem('5010511482313'), lookup: 'found' };
  item.snapshot = { ...item.snapshot, displayName: 'Barratt Fruit Salad', packSize: '120G' };
  const c = renderShelfLabel('standard', itemToShelfContent(item), BASE);
  assert.equal(nodes(c, 'price').length, 0);
  const all = JSON.stringify(inked(c));
  assert.equal(all.includes('0.00'), false);
  assert.ok(c.nodes.some((n) => n.previewOnly && n.lines?.[0] === 'Needs price'));
});

check('Owner-edited price is what the label prints', () => {
  let item = { ...createPendingItem('5010511482313'), lookup: 'found' };
  item.snapshot = { ...item.snapshot, displayName: 'Barratt Fruit Salad' };
  item = setPriceText({ ...item, priceText: '1.15' }, '8.49');
  const price = nodes(renderShelfLabel('standard', itemToShelfContent(item), BASE), 'price')[0];
  assert.equal(`${price.major}${price.minor}`, '£8.49');
});

check('Real barcodes decode from generated modules (EAN-13, UPC-A, leading zero)', () => {
  assert.equal(decodeEan13(encodeBarcode('5010511482313', 'EAN13').modules), '5010511482313');
  assert.equal(decodeEan13(encodeBarcode('072417337253', 'UPCA').modules), '0072417337253');
  assert.equal(encodeBarcode('5010511482313', 'EAN13').symbolModules, 95);
});

check('Long product names are reported instead of overlapping the price', () => {
  const long = { ...FIXTURE_STANDARD, name: 'Extraordinarily Long Premium Marlborough Sauvignon Blanc Reserve Selection Limited Edition Gift Pack' };
  const c = renderShelfLabel('standard', long, BASE);
  assert.ok(c.warnings.some((w) => /Name is too long/.test(w)));
  const name = nodes(c, 'text')[0];
  const price = nodes(c, 'price')[0];
  assert.ok(name.yMm + name.lines.length * name.lineHeightMm <= price.yMm + 0.01, 'name stays above price');
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
