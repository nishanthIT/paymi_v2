// Batch 7 verification: mixed-sheet chooser text/order, M01–M07 geometry,
// slot compatibility, filled/empty sheets, layout changes that keep work,
// Custom packing without scaling, validation, and real A4 PDFs.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch7-check.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSheetHtml } from '../src/features/labels/export/sheet-html.ts';
import { applyLookupResult, createPendingItem, setPriceText } from '../src/features/labels/model/label-item.ts';
import {
  addEntry,
  cellSizes,
  changeLayout,
  compatibleEmptyCells,
  compatibleTemplates,
  newEntry,
  placeInCell,
  readMixedState,
  removeEntry,
  unplacedEntries,
} from '../src/features/labels/model/mixed.ts';
import { MIXED_LAYOUTS, TEMPLATES } from '../src/features/labels/registry/manifest.ts';
import { CUSTOM_SIZES, CUSTOM_SPACING, MIXED_CELLS, SIZE_LABEL } from '../src/features/labels/registry/mixed-geometry.ts';
import { LABEL_SIZES, mmToPt } from '../src/features/labels/registry/sizes.ts';
import { compositionToSvg } from '../src/features/labels/render/composition-svg.ts';
import { buildMixedJob, packCustom, renderEntry } from '../src/features/labels/render/mixed-sheet.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

const EPS = 0.01;
const PAGE = LABEL_SIZES.A4_PORTRAIT;
const overlaps = (a, b) => a.xMm < b.xMm + b.wMm - EPS && b.xMm < a.xMm + a.wMm - EPS && a.yMm < b.yMm + b.hMm - EPS && b.yMm < a.yMm + a.hMm - EPS;
const inked = (c) => c.nodes.filter((n) => !n.previewOnly);
const texts = (c) => c.nodes.filter((n) => n.kind === 'text').flatMap((n) => n.lines);

function product(barcode, title, price, rrp = null) {
  const item = applyLookupResult(createPendingItem(barcode), { id: barcode, title, rrp });
  return price ? setPriceText(item, price) : item;
}
/** Fill a fixed layout: [[cellIndex, templateId, item], …] → { state, items }. */
function filled(layoutId, fills) {
  let state = changeLayout(readMixedState({}), layoutId);
  const items = [];
  for (const [cell, templateId, item] of fills) {
    const entry = { ...newEntry(cellSizes(layoutId)[cell], templateId), itemId: item?.id };
    if (item) items.push(item);
    state = addEntry(state, entry, cell);
  }
  return { state, items };
}

// ---- Chooser (R03 + R02) ----
const REFERENCE = [
  ['M00', 'Custom', 'None of these - build your own. Add labels one at a time, any size, auto-arranged.', 0],
  ['M01', '3 × 8 × 3 in', 'Three full-width shelf labels stacked', 3],
  ['M02', '3 × 6 × 3 in', 'Three medium shelf labels stacked, centred', 3],
  ['M03', '6 × 4 × 3 in', 'Two columns × three rows of compact labels', 6],
  ['M04', 'Mixed shelf (8×3 + 6×3 + 4×3)', 'One of each shelf size, stacked', 3],
  ['M05', '1 × 8×3 + 4 × 4×3', 'Hero shelf label on top, four compact labels in 2×2 below', 5],
  ['M06', '6 × 7 × 7 cm (alcohol)', 'Two columns × three rows of square alcohol tags', 6],
  ['M07', '4 × 7 × 7 cm + 1 × 6 × 3', 'Four square alcohol tags + one shelf label below', 5],
];

check('Chooser: Custom + seven fixed layouts in exact order, titles, descriptions and label counts', () => {
  assert.deepEqual(MIXED_LAYOUTS.map((l) => [l.id, l.title, l.description, l.cells.length]), REFERENCE);
  const route = readFileSync(new URL('../src/app/(app)/labels/mixed.tsx', import.meta.url), 'utf8');
  assert.ok(route.includes("'Pick a sheet, then a layout. Each layout has cells of fixed sizes - fill them with any compatible template.'"), 'intro text');
  assert.ok(route.includes('title="Mixed sheet"'));
  const parts = readFileSync(new URL('../src/features/labels/components/mixed-parts.tsx', import.meta.url), 'utf8');
  for (const s of ['Print sheet', 'labels</Text>', 'Tap to fill', 'Refresh preview', 'Generate PDF', 'Change']) assert.ok(parts.includes(s), s);
});

check('Every cell is its exact physical size, inside A4, with no overlaps', () => {
  for (const [id] of REFERENCE.slice(1)) {
    const cells = MIXED_CELLS[id];
    assert.deepEqual(cells.map((c) => c.sizeId), MIXED_LAYOUTS.find((l) => l.id === id).cells.map((c) => c.sizeId), id);
    for (const c of cells) {
      assert.equal(c.wMm, LABEL_SIZES[c.sizeId].widthMm, `${id} width`);
      assert.equal(c.hMm, LABEL_SIZES[c.sizeId].heightMm, `${id} height`);
      assert.ok(c.xMm >= -EPS && c.xMm + c.wMm <= PAGE.widthMm + EPS && c.yMm >= 0 && c.yMm + c.hMm <= PAGE.heightMm, `${id} inside`);
    }
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) assert.ok(!overlaps(cells[i], cells[j]), `${id} cells ${i + 1}/${j + 1} overlap`);
  }
});

check('Topology matches the schematics (stacked, centred, 2 × 3, wide→medium→compact, hero + 2 × 2, squares + shelf)', () => {
  const centred = (c) => Math.abs(c.xMm + c.wMm / 2 - PAGE.widthMm / 2) < EPS;
  assert.ok(MIXED_CELLS.M01.every(centred) && MIXED_CELLS.M02.every(centred) && MIXED_CELLS.M04.every(centred));
  const ys = (cells) => cells.map((c) => c.yMm);
  assert.ok(ys(MIXED_CELLS.M01).every((y, i, a) => i === 0 || y > a[i - 1] + 76.2 - EPS), 'M01 stacked');
  assert.deepEqual(MIXED_CELLS.M04.map((c) => c.sizeId), ['SHELF_8X3', 'SHELF_6X3', 'SHELF_4X3']);
  // Two 4 in columns: 203.2 mm leaves exactly 6.8 mm for both margins and the gap.
  const [a, b] = MIXED_CELLS.M03;
  assert.ok(Math.abs(a.xMm + (PAGE.widthMm - (b.xMm + b.wMm)) + (b.xMm - (a.xMm + a.wMm)) - 6.8) < EPS, 'M03 6.8 mm');
  assert.equal(a.yMm, b.yMm);
  assert.equal(new Set(ys(MIXED_CELLS.M03)).size, 3, 'M03 three rows');
  const [hero, ...compact] = MIXED_CELLS.M05;
  assert.ok(compact.every((c) => c.yMm >= hero.yMm + hero.hMm), 'M05 hero on top');
  assert.equal(new Set(compact.map((c) => c.yMm)).size, 2, 'M05 2 × 2');
  assert.equal(new Set(MIXED_CELLS.M06.map((c) => c.xMm)).size, 2, 'M06 two columns');
  const shelf = MIXED_CELLS.M07[4];
  assert.ok(centred(shelf) && MIXED_CELLS.M07.slice(0, 4).every((c) => c.yMm + c.hMm <= shelf.yMm), 'M07 shelf below squares');
});

check('Captured editors: M02 = three "Shelf · 6 × 3 in"; M05 = "Shelf · 8 × 3 in" + four "Shelf · 4 × 3 in"', () => {
  assert.deepEqual(cellSizes('M02').map((s) => SIZE_LABEL[s]), ['Shelf · 6 × 3 in', 'Shelf · 6 × 3 in', 'Shelf · 6 × 3 in']);
  assert.deepEqual(cellSizes('M05').map((s) => SIZE_LABEL[s]), ['Shelf · 8 × 3 in', ...Array(4).fill('Shelf · 4 × 3 in')]);
  const summary = MIXED_LAYOUTS.find((l) => l.id === 'M02');
  assert.equal(`${summary.description} · A4 · portrait`, 'Three medium shelf labels stacked, centred · A4 · portrait');
});

check('Slot compatibility is exact physical size; Show all never admits another size', () => {
  const ids = (size, all) => compatibleTemplates(size, all).map((t) => t.id);
  assert.deepEqual(ids('SHELF_8X3'), ['T08', 'T09', 'T10', 'T11']);
  assert.deepEqual(ids('SHELF_6X3'), ['T12', 'T13', 'T14', 'T15']);
  assert.deepEqual(ids('SHELF_4X3'), ['T16', 'T17', 'T18', 'T19']);
  assert.deepEqual(ids('ALCOHOL_SQUARE'), ['T04', 'T05', 'T06', 'T07']);
  for (const size of ['SHELF_8X3', 'SHELF_6X3', 'SHELF_4X3', 'ALCOHOL_SQUARE']) {
    assert.deepEqual(ids(size, true), ids(size), `${size} show all`);
    assert.ok(!ids(size, true).some((id) => TEMPLATES.find((t) => t.id === id).section === 'A4'), `${size}: no A4 poster`);
  }
  assert.ok(!ids('SHELF_8X3', true).includes('T01'), '203 × 75 GB family is not 8 × 3 in');
});

check('An A4 poster (or any other size) can’t be placed or rendered in a 6 × 3 in slot', () => {
  const stored = { layoutId: 'M02', entries: [{ id: 'a', sizeId: 'SHELF_6X3', templateId: 'T20' }], cells: ['a', '', ''] };
  assert.equal(readMixedState(stored).entries[0].templateId, undefined, 'persisted poster dropped from the slot');
  assert.throws(() => renderEntry({ ...newEntry('SHELF_6X3', 'T20') }, undefined), /can't go in a 152 × 76 mm slot/);
  let state = changeLayout(readMixedState({}), 'M02');
  state = addEntry(state, newEntry('SHELF_4X3', 'T17'));
  assert.equal(placeInCell(state, state.entries[0].id, 0).cells[0], '', '4 × 3 entry refused by a 6 × 3 cell');
});

check('Empty layouts: sheet keeps every cell blank (guides preview-only), nothing inked, PDF blocked', () => {
  for (const id of ['M02', 'M05']) {
    const job = buildMixedJob(changeLayout(readMixedState({}), id), []);
    assert.equal(job.filled, 0);
    assert.equal(job.pages.length, 1);
    assert.equal(inked(job.pages[0]).length, 0, `${id} inked`);
    assert.equal(job.pages[0].nodes.filter((n) => n.kind === 'rect').length, MIXED_CELLS[id].length, `${id} one guide per cell`);
  }
});

const coke = () => product('5449000130389', 'Coca-Cola 330ml', '1.25', '1.35');
const pepsi = () => product('4060800001306', 'Pepsi Max 500ml', '1.49');

check('Filled slots render at their cell position and exact size; empty slot stays blank in place', () => {
  const { state, items } = filled('M02', [[0, 'T13', coke()], [2, 'T12', pepsi()]]);
  const job = buildMixedJob(state, items);
  assert.equal(job.filled, 2);
  assert.equal(job.issues.length, 0, JSON.stringify(job.issues));
  const page = job.pages[0];
  assert.deepEqual([page.widthMm, page.heightMm], [210, 297]);
  const [c1, c2, c3] = MIXED_CELLS.M02;
  const ink = inked(page);
  assert.ok(ink.every((n) => [c1, c3].some((c) => n.xMm >= c.xMm - EPS && n.yMm >= c.yMm - EPS && n.xMm + (n.wMm ?? 0) <= c.xMm + c.wMm + EPS)), 'ink only in filled cells');
  assert.equal(ink.filter((n) => n.yMm >= c2.yMm && n.yMm < c2.yMm + c2.hMm).length, 0, 'slot 2 blank');
  const own = renderEntry(state.entries[0], items[0]);
  assert.equal(ink.filter((n) => n.yMm >= c1.yMm && n.yMm < c1.yMm + c1.hMm).length, inked(own).length, 'slot 1 = its own artwork, unscaled');
  const texts1 = inked(page).filter((n) => n.kind === 'text').flatMap((n) => n.lines).join('|');
  assert.ok(texts1.includes('£1.25') && texts1.includes('£1.49') && !texts1.includes('£1.35'), 'owner prices, never RRP');
});

check('M05 mixed sizes: hero 8 × 3 and a 4 × 3 fill their own cells', () => {
  const { state, items } = filled('M05', [[0, 'T09', coke()], [3, 'T17', pepsi()]]);
  const job = buildMixedJob(state, items);
  assert.equal(job.issues.length, 0);
  const hero = renderEntry(state.entries[0], items[0]);
  assert.equal(hero.widthMm, 203.2);
  const small = renderEntry(state.entries[1], items[1]);
  assert.equal(small.widthMm, 101.6);
  const cell = MIXED_CELLS.M05[3];
  const moved = inked(job.pages[0]).filter((n) => n.xMm >= cell.xMm - EPS && n.yMm >= cell.yMm - EPS && n.yMm < cell.yMm + cell.hMm);
  assert.equal(moved.length, inked(small).length);
});

check('Export validation: incomplete populated slot blocks; valid subset allowed; price-less design OK', () => {
  const noPrice = product('5060116211443', 'Tuscan Chicken Soup', null);
  const a = filled('M02', [[0, 'T13', coke()], [1, 'T13', noPrice]]);
  const job = buildMixedJob(a.state, a.items);
  assert.deepEqual(job.issues.map((i) => [i.slot, i.message]), [[2, 'Enter the price for this label']]);
  const b = filled('M02', [[1, 'T13', coke()]]);
  assert.equal(buildMixedJob(b.state, b.items).issues.length, 0, 'one filled slot is a valid subset');
  const c = filled('M05', [[1, 'T16', noPrice]]);
  assert.equal(buildMixedJob(c.state, c.items).issues.length, 0, 'Circle Badge prints no price');
  const d = filled('M02', [[0, 'T13', null]]);
  assert.deepEqual(buildMixedJob(d.state, d.items).issues.map((i) => i.message), ['Add a product']);
  const e = filled('M02', [[0, undefined, coke()]]);
  assert.deepEqual(buildMixedJob(e.state, e.items).issues.map((i) => i.message), ['Choose a design']);
  const long = product('5010511482313', 'Extraordinarily Long Premium Assorted Fruit Flavour Chewy Sweets Sharing Bag Limited Edition Mega Size Multipack', '0.99');
  const f = filled('M05', [[1, 'T17', long]]);
  assert.ok(buildMixedJob(f.state, f.items).issues.some((i) => /too long/.test(i.message)), 'long name blocks');
});

check('Changing layout keeps work: compatible entries re-placed, others queued (never erased), round-trip restores', () => {
  const a = filled('M02', [[0, 'T13', coke()], [1, 'T12', pepsi()], [2, 'T14', coke()]]);
  const ids = a.state.entries.map((e) => e.id);
  const m05 = changeLayout(a.state, 'M05');
  assert.equal(m05.entries.length, 3);
  assert.deepEqual(m05.cells, ['', '', '', '', '']);
  assert.equal(unplacedEntries(m05).length, 3, 'all 6 × 3 labels kept in the queue');
  const m04 = changeLayout(m05, 'M04');
  assert.deepEqual(m04.cells, ['', ids[0], '']);
  assert.deepEqual(unplacedEntries(m04).map((e) => e.id), [ids[1], ids[2]]);
  assert.deepEqual(changeLayout(m04, 'M02').cells, [ids[0], ids[1], ids[2]], 'back to M02 restores all three');
  const custom = changeLayout(m04, 'M00');
  assert.deepEqual(custom.entries.map((e) => e.id), [ids[0], ids[1], ids[2]], 'Custom keeps all, placed first');
  // Custom 8 × 3 + 4 × 3 → M05 places both.
  let c = changeLayout(readMixedState({}), 'M00');
  c = addEntry(addEntry(c, newEntry('SHELF_4X3', 'T17')), newEntry('SHELF_8X3', 'T09'));
  const placed = changeLayout(c, 'M05');
  assert.deepEqual(placed.cells, [c.entries[1].id, c.entries[0].id, '', '', '']);
  assert.equal(unplacedEntries(placed).length, 0);
});

check('Duplicate targets are only empty same-size cells; removing frees the cell', () => {
  const a = filled('M05', [[1, 'T17', coke()]]);
  assert.deepEqual(compatibleEmptyCells(a.state, a.state.entries[0].id), [2, 3, 4]);
  const hero = filled('M05', [[0, 'T09', coke()]]);
  assert.deepEqual(compatibleEmptyCells(hero.state, hero.state.entries[0].id), []);
  assert.deepEqual(removeEntry(a.state, a.state.entries[0].id).cells, ['', '', '', '', '']);
});

check('Custom packing: exact sizes, inside margins, no overlaps, owner order, overflow → new pages', () => {
  const size = (id) => ({ wMm: LABEL_SIZES[id].widthMm, hMm: LABEL_SIZES[id].heightMm });
  const blocks = [
    ...Array.from({ length: 7 }, (_, i) => ({ key: `w${i}`, ...size('SHELF_8X3') })),
    ...Array.from({ length: 5 }, (_, i) => ({ key: `c${i}`, ...size('SHELF_4X3') })),
    ...Array.from({ length: 3 }, (_, i) => ({ key: `s${i}`, ...size('ALCOHOL_SQUARE') })),
  ];
  const { pages, unfit } = packCustom(blocks);
  assert.equal(unfit.length, 0);
  const flat = pages.flat();
  assert.deepEqual(flat.map((p) => p.key), blocks.map((b) => b.key), 'order kept');
  for (const p of flat) {
    const b = blocks.find((x) => x.key === p.key);
    assert.equal(p.wMm, b.wMm);
    assert.equal(p.hMm, b.hMm);
    assert.ok(p.xMm >= CUSTOM_SPACING.marginXMm - EPS && p.xMm + p.wMm <= PAGE.widthMm - CUSTOM_SPACING.marginXMm + EPS, `${p.key} x`);
    assert.ok(p.yMm >= CUSTOM_SPACING.marginYMm - EPS && p.yMm + p.hMm <= PAGE.heightMm - CUSTOM_SPACING.marginYMm + EPS, `${p.key} y`);
  }
  for (const page of pages) for (let i = 0; i < page.length; i++) for (let j = i + 1; j < page.length; j++) assert.ok(!overlaps(page[i], page[j]), `${page[i].key}/${page[j].key}`);
  // 8 × 3 three per page; 4 × 3 two per row; a square shares a row with a 4 × 3.
  assert.deepEqual(pages.map((p) => p.length), [3, 3, 5, 4]);
  assert.ok(pages.length > 1, 'overflow made extra pages instead of shrinking');
});

check('Custom: a label that can’t fit is identified (not shrunk, not dropped silently)', () => {
  const { pages, unfit } = packCustom([{ key: 'poster', wMm: 210, hMm: 297 }, { key: 'ok', wMm: 101.6, hMm: 76.2 }]);
  assert.deepEqual(unfit, ['poster']);
  assert.deepEqual(pages.flat().map((p) => p.key), ['ok']);
  let s = changeLayout(readMixedState({}), 'M00');
  s = addEntry(s, { ...newEntry('A4_PORTRAIT'), templateId: undefined });
  const job = buildMixedJob(s, []);
  assert.ok(job.issues.some((i) => /doesn’t fit on A4 · portrait/.test(i.message)), JSON.stringify(job.issues));
  assert.ok(CUSTOM_SIZES.every((id) => packCustom([{ key: id, wMm: LABEL_SIZES[id].widthMm, hMm: LABEL_SIZES[id].heightMm }]).unfit.length === 0), 'every offered size fits');
});

check('Custom job: copies expand, labels drawn at full size, empty entries flagged', () => {
  let s = changeLayout(readMixedState({}), 'M00');
  const item = coke();
  s = addEntry(s, { ...newEntry('SHELF_8X3', 'T09'), itemId: item.id, copies: 4 });
  s = addEntry(s, newEntry('SHELF_4X3', 'T17'));
  const job = buildMixedJob(s, [item]);
  assert.equal(job.pages.length, 2, '4 hero labels → 2 pages (3 + 1 and the compact one)');
  assert.equal(texts(job.pages[0]).filter((l) => l === '£1.25').length, 3);
  assert.deepEqual(job.issues.map((i) => [i.slot, i.message]), [[2, 'Add a product']]);
});

check('Export excludes preview-only guides and captions', () => {
  const { state, items } = filled('M02', [[0, 'T13', coke()]]);
  const svg = compositionToSvg(buildMixedJob(state, items).pages[0]);
  assert.equal(svg.includes('#A9C4EC'), false, 'no slot guides');
  assert.equal(/>2<\/text>|>3<\/text>/.test(svg), false, 'no slot numbers');
});

// ---- Real PDFs from the exact HTML the app prints ----
const chromium = ['chromium', 'google-chrome'].find((bin) => {
  try {
    execFileSync('which', [bin]);
    return true;
  } catch {
    return false;
  }
});
function printPdf(html) {
  const dir = mkdtempSync(join(tmpdir(), 'labels-mixed-'));
  writeFileSync(join(dir, 'sheet.html'), html);
  execFileSync(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(dir, 'sheet.pdf')}`, `file://${join(dir, 'sheet.html')}`], { stdio: 'ignore' });
  const raw = readFileSync(join(dir, 'sheet.pdf'), 'latin1');
  return [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
}

check('Fixed-sheet PDF: one A4 page, MediaBox 595.28 × 841.89 pt', () => {
  assert.ok(chromium, 'headless Chromium not found');
  const { state, items } = filled('M05', [[0, 'T09', coke()], [2, 'T17', pepsi()]]);
  const boxes = printPdf(buildSheetHtml(buildMixedJob(state, items).pages));
  assert.equal(boxes.length, 1);
  assert.ok(Math.abs(boxes[0][0] - mmToPt(210)) < 1 && Math.abs(boxes[0][1] - mmToPt(297)) < 1, JSON.stringify(boxes));
});

check('Custom overflow PDF: page count equals the packed pages, each A4', () => {
  let s = changeLayout(readMixedState({}), 'M00');
  const item = coke();
  s = addEntry(s, { ...newEntry('SHELF_8X3', 'T09'), itemId: item.id, copies: 7 });
  const job = buildMixedJob(s, [item]);
  assert.equal(job.pages.length, 3);
  const boxes = printPdf(buildSheetHtml(job.pages));
  assert.equal(boxes.length, 3);
  for (const [w, h] of boxes) assert.ok(Math.abs(w - mmToPt(210)) < 1 && Math.abs(h - mmToPt(297)) < 1);
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
