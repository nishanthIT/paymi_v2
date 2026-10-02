// Batch 9 verification: real PDFs from the exact HTML every output route prints,
// measured MediaBoxes, rasterised pages decoded by an independent decoder
// (zxing-cpp), physical barcode placement/module size in mm, PDF text for
// prices/dates, and the scan → price → print model workflow.
// Needs: chromium, mutool, and a Python with zxing-cpp (ZX_PYTHON, default /tmp/zx/bin/python).
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch9-check.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSheetHtml } from '../src/features/labels/export/sheet-html.ts';
import { applyLookupResult, createCustomItem, createPendingItem, setPriceText, setRrpText } from '../src/features/labels/model/label-item.ts';
import { addEntry, changeLayout, newEntry, readMixedState } from '../src/features/labels/model/mixed.ts';
import { LABEL_SIZES, mmToPt, STANDARD_SHELF_SHEET as SHEET } from '../src/features/labels/registry/sizes.ts';
import { buildMixedJob } from '../src/features/labels/render/mixed-sheet.ts';
import { itemPrintIssues } from '../src/features/labels/render/print-checks.ts';
import { composeGridPages, composeTemplatePages, nextStartCell } from '../src/features/labels/render/print-jobs.ts';
import { renderSticker } from '../src/features/labels/render/reduced-sticker.ts';
import { cellRect, expandInstances, paginate } from '../src/features/labels/render/sheet-layout.ts';
import { renderShelfLabel } from '../src/features/labels/render/shelf-label.ts';
import { composeRunnerPages, readRunnerSettings, renderRunner } from '../src/features/labels/render/shelf-runner.ts';
import { itemToShelfContent } from '../src/features/labels/render/shelf-settings.ts';
import { itemToStickerContent } from '../src/features/labels/render/sticker-settings.ts';
import { itemToTalkerContent, readTalkerSettings } from '../src/features/labels/render/talker-settings.ts';
import { renderTemplate } from '../src/features/labels/render/templates.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

const ZX = process.env.ZX_PYTHON ?? '/tmp/zx/bin/python';
const which = (bin) => {
  try {
    execFileSync('which', [bin]);
    return true;
  } catch {
    return false;
  }
};
const CHROMIUM = ['chromium', 'google-chrome'].find(which);
const TOOLS_OK = !!CHROMIUM && which('mutool') && existsSync(ZX);
const DPI = 600;
const PX_PER_MM = DPI / 25.4;

/** Print the app's HTML to a PDF with headless Chromium; return MediaBoxes, page PNGs and text. */
function printPdf(pages, name) {
  assert.ok(TOOLS_OK, `missing tools: chromium=${!!CHROMIUM} mutool=${which('mutool')} zxing=${existsSync(ZX)}`);
  const dir = mkdtempSync(join(tmpdir(), `labels-b9-${name}-`));
  writeFileSync(join(dir, 'doc.html'), buildSheetHtml(pages));
  execFileSync(CHROMIUM, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(dir, 'doc.pdf')}`, `file://${join(dir, 'doc.html')}`], { stdio: 'ignore' });
  const raw = readFileSync(join(dir, 'doc.pdf'), 'latin1');
  const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
  execFileSync('mutool', ['draw', '-q', '-r', String(DPI), '-o', join(dir, 'page%d.png'), join(dir, 'doc.pdf')], { stdio: 'ignore' });
  const text = execFileSync('mutool', ['draw', '-q', '-F', 'txt', '-o', '-', join(dir, 'doc.pdf')]).toString('utf8');
  const pngs = readdirSync(dir).filter((f) => /^page\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4))).map((f) => join(dir, f));
  return { dir, boxes, pngs, text };
}

/** Independent decode (zxing-cpp) of every barcode on a rasterised page; positions in mm. */
function decode(png, formats = 'LinearCodes') {
  const py = `
import json, sys, zxingcpp
from PIL import Image
img = Image.open(sys.argv[1]).convert('L')
out = []
for b in zxingcpp.read_barcodes(img, formats=getattr(zxingcpp.BarcodeFormat, sys.argv[2]), try_rotate=True):
    p = b.position
    xs = [p.top_left.x, p.top_right.x, p.bottom_left.x, p.bottom_right.x]
    ys = [p.top_left.y, p.top_right.y, p.bottom_left.y, p.bottom_right.y]
    out.append({'text': b.text, 'format': str(b.format).split('.')[-1], 'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys)})
print(json.dumps(out))`;
  return JSON.parse(execFileSync(ZX, ['-c', py, png, formats]).toString()).map((b) => ({
    ...b,
    x0: b.x0 / PX_PER_MM,
    x1: b.x1 / PX_PER_MM,
    y0: b.y0 / PX_PER_MM,
    y1: b.y1 / PX_PER_MM,
  }));
}

const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const assertBox = (boxes, wMm, hMm, pages) => {
  assert.equal(boxes.length, pages, `pages: ${boxes.length}`);
  for (const [w, h] of boxes) assert.ok(near(w, mmToPt(wMm)) && near(h, mmToPt(hMm)), `MediaBox ${w.toFixed(2)} × ${h.toFixed(2)} pt ≠ ${mmToPt(wMm).toFixed(2)} × ${mmToPt(hMm).toFixed(2)}`);
};
const inside = (b, r, slack = 0.3) => b.x0 >= r.xMm - slack && b.x1 <= r.xMm + r.wMm + slack && b.y0 >= r.yMm - slack && b.y1 <= r.yMm + r.hMm + slack;

function product(barcode, title, price, rrp = null) {
  const item = applyLookupResult(createPendingItem(barcode), { id: barcode, title, rrp });
  return price ? setPriceText(item, price) : item;
}
const OPTS = { penceSameSize: false, priceOnRight: true, barcodeDownSide: false, widthRatio: 1, colouredStock: false };
function shelfJob(items, design, opts, startAt) {
  const comps = new Map(items.map((i) => [i.id, renderShelfLabel(design, itemToShelfContent(i), { ...OPTS, ...opts })]));
  const pages = paginate(expandInstances(items), startAt, SHEET);
  return { pages, out: composeGridPages(pages, (id) => comps.get(id), SHEET), comps };
}

// ---------- Scan → price → print (model) ----------
check('Scan → RRP £8.75 prefills Price; owner £8.49 survives a lookup refresh and is what prints', () => {
  let item = applyLookupResult(createPendingItem('5010511482313'), { id: 'p', title: 'Mud House Sauvignon Blanc 75cl', rrp: '8.75' });
  assert.equal(item.priceText, '8.75');
  item = setPriceText(item, '8.49');
  item = applyLookupResult(item, { id: 'p', title: 'Mud House Sauvignon Blanc 75cl', rrp: '8.75' });
  assert.equal(item.priceText, '8.49', 'refresh keeps the owner price');
  item = setRrpText(item, '9.99');
  assert.equal(item.priceText, '8.49', 'owner RRP never replaces an edited price');
  assert.equal(item.wasText, '', 'RRP never becomes Was');
  const { out } = shelfJob([item], 'standard', { penceSameSize: true }, 1);
  const pdf = printPdf(out, 'scan');
  assertBox(pdf.boxes, 210, 297, 1);
  assert.ok(pdf.text.includes('£8.49'), 'PDF text has £8.49');
  assert.equal(pdf.text.includes('£8.75'), false, 'RRP not printed');
  const bars = decode(pdf.pngs[0]);
  assert.deepEqual(bars.map((b) => [b.text, b.format]), [['5010511482313', 'EAN-13']]);
});

check('Found without RRP / unknown code never manufacture a price; output is blocked until priced', () => {
  const noRrp = product('5060116211443', 'Tuscan Chicken Soup', null);
  assert.equal(noRrp.priceText, '');
  const unknown = applyLookupResult(createPendingItem('5000000000005'), null);
  assert.equal(unknown.snapshot.barcode, '5000000000005');
  assert.equal(unknown.priceText, '');
  const c = renderShelfLabel('standard', itemToShelfContent(noRrp), OPTS);
  assert.ok(itemPrintIssues(noRrp, c).includes('Enter the price for this label'));
  assert.equal(JSON.stringify(c.nodes.filter((n) => !n.previewOnly)).includes('£0.00'), false);
});

// ---------- Standard shelf sheets ----------
check('Standard sheet: Start at 21 × 2 → 2 A4 pages; barcodes decode in cell 21 and cell 1 at true position', () => {
  const item = { ...product('5010511482313', 'Barratt Fruit Salad Duo 120G', '0.99'), copies: 2 };
  const { pages, out } = shelfJob([item], 'standard', {}, 21);
  assert.equal(nextStartCell(pages, SHEET), 2);
  const pdf = printPdf(out, 'std21');
  assertBox(pdf.boxes, 210, 297, 2);
  const p1 = decode(pdf.pngs[0]);
  const p2 = decode(pdf.pngs[1]);
  assert.equal(p1.length, 1);
  assert.equal(p2.length, 1);
  assert.ok(inside(p1[0], cellRect(SHEET, 21)), `page 1 barcode at ${p1[0].x0.toFixed(1)},${p1[0].y0.toFixed(1)} mm not in cell 21`);
  assert.ok(inside(p2[0], cellRect(SHEET, 1)), 'page 2 barcode in cell 1');
  assert.equal(p1[0].text, '5010511482313');
  // EAN-13 is 95 modules wide between guards; decoded extent ≈ 95 × module.
  const moduleMm = (p1[0].x1 - p1[0].x0) / 95;
  assert.ok(moduleMm >= 0.24, `module ${moduleMm.toFixed(3)} mm`);
});

check('Start at 1 × 22 → 21 labels then 1; every label decodes in its own 70 × 38 mm cell', () => {
  const item = { ...product('5010511482313', 'Barratt Fruit Salad Duo', '0.99'), copies: 22 };
  const { out } = shelfJob([item], 'standard', {}, 1);
  const pdf = printPdf(out, 'std22');
  assertBox(pdf.boxes, 210, 297, 2);
  const p1 = decode(pdf.pngs[0]);
  assert.equal(p1.length, 21, `page 1 decoded ${p1.length}`);
  for (let cell = 1; cell <= 21; cell++) assert.equal(p1.filter((b) => inside(b, cellRect(SHEET, cell))).length, 1, `cell ${cell}`);
  assert.equal(decode(pdf.pngs[1]).length, 1);
});

check('Symbologies decode from the PDF: EAN-13, UPC-A (leading zero kept), EAN-8, Code 128 custom, barcode down the side', () => {
  const custom = { ...setPriceText(createCustomItem('SHOP-0042'), '1.50'), snapshot: { ...createCustomItem('SHOP-0042').snapshot, displayName: 'House loaf', customCode: true } };
  const items = [product('5010511482313', 'EAN-13 item', '1.00'), product('072417337253', 'UPC-A item', '2.00'), product('96385074', 'EAN-8 item', '3.00'), custom];
  const flat = shelfJob(items, 'standard', {}, 1);
  const side = shelfJob([product('5010511482313', 'Sideways', '1.00')], 'standard', { barcodeDownSide: true }, 1);
  const pdf = printPdf([...flat.out, ...side.out], 'symb');
  const got = decode(pdf.pngs[0]).map((b) => `${b.format}:${b.text}`).sort();
  // A UPC-A symbol is bar-identical to EAN-13 with a leading 0, so a generic read reports it that way…
  assert.deepEqual(got, ['Code 128:SHOP-0042', 'EAN-13:0072417337253', 'EAN-13:5010511482313', 'EAN-8:96385074'].sort());
  // …and a UPC-A-only read accepts it as UPC-A (zxing-cpp always reports the 13-digit form, as it does for its own UPC-A symbols).
  assert.deepEqual(decode(pdf.pngs[0], 'UPCA').map((b) => `${b.format}:${b.text}`), ['UPC-A:0072417337253']);
  const rotated = decode(pdf.pngs[1]);
  assert.deepEqual(rotated.map((b) => b.text), ['5010511482313'], 'upright barcode decodes');
  assert.ok(rotated[0].y1 - rotated[0].y0 > rotated[0].x1 - rotated[0].x0, 'bars run down the side');
});

check('Promo sheet: previous £11.25, each £8.75 and 2 FOR £16 all print; yellow stock left unprinted when chosen', () => {
  const item = { ...product('5010511482313', 'Mud House Sauvignon Blanc 75cl', '8.75'), wasText: '11.25', offerQuantityText: '2', offerTotalText: '16' };
  const printed = shelfJob([item], 'half_yellow', { penceSameSize: true }, 1);
  const pdf = printPdf(printed.out, 'promo');
  for (const s of ['£11.25', '£8.75', '£16']) assert.ok(pdf.text.includes(s), s);
  assert.ok(/2\s*FOR/.test(pdf.text));
  assert.deepEqual(decode(pdf.pngs[0]).map((b) => b.text), ['5010511482313']);
  const stock = shelfJob([item], 'half_yellow', { colouredStock: true }, 1);
  assert.equal(JSON.stringify(stock.out[0].nodes.filter((n) => !n.previewOnly)).includes('#F6DA3B'), false, 'no yellow ink on yellow stock');
});

check('Job date prints once, as captured', () => {
  const { out } = shelfJob([product('5010511482313', 'Dated', '1.00')], 'standard', { dateText: '25/09/2026' }, 1);
  assert.ok(printPdf(out, 'date').text.includes('25/09/2026'));
});

// ---------- Reduced sticker roll PDFs ----------
for (const [w, h] of [[50, 30], [50, 25], [40, 30], [30, 50]]) {
  check(`Reduced sticker ${w} × ${h} mm roll PDF: page = label, 2 copies = 2 pages, barcode decodes`, () => {
    const item = { ...setPriceText(createCustomItem('5000168001357'), '7.99'), wasText: '13.69', copies: 2 };
    const c = renderSticker('was_now', itemToStickerContent(item, 'REDUCED'), { widthMm: w, heightMm: h, background: 'yellow', textColour: 'black' });
    assert.equal(c.warnings.length, 0, c.warnings.join('; '));
    const pdf = printPdf([c, c], `roll${w}x${h}`);
    assertBox(pdf.boxes, w, h, 2);
    for (const png of pdf.pngs) assert.deepEqual(decode(png).map((b) => b.text), ['5000168001357']);
    assert.ok(pdf.text.includes('£7.99') && pdf.text.includes('£13.69'));
  });
}

// ---------- Talkers and posters ----------
check('Shelf talkers print true size on A4 (T01 203 × 75, T04 70 × 70, T09 8 × 3, T13 6 × 3, T17 4 × 3); nothing scaled', () => {
  const content = itemToTalkerContent(product('5010511482313', 'Barratt Fruit Salad Duo', '0.99'), readTalkerSettings({}));
  for (const [id, copies, expectPages] of [['T01', 5, 2], ['T04', 6, 1], ['T09', 3, 1], ['T13', 4, 2], ['T17', 6, 1]]) {
    const c = renderTemplate(id, [content]);
    const pages = composeTemplatePages(c, copies);
    assert.equal(pages.length, expectPages, `${id} pages`);
    // The card's full-size nodes survive unscaled: every node keeps its width.
    const widths = c.nodes.filter((n) => 'wMm' in n).map((n) => n.wMm).sort();
    const placed = pages[0].nodes.filter((n) => 'wMm' in n).map((n) => n.wMm);
    for (const wMm of widths) assert.ok(placed.includes(wMm), `${id} node width ${wMm} kept`);
    const pdf = printPdf(pages, id);
    assertBox(pdf.boxes, 210, 297, expectPages);
    assert.ok(pdf.text.includes('£0.99') || pdf.text.includes('£0.') , `${id} price in PDF`);
  }
});

check('A4 posters: portrait 595.28 × 841.89 pt and landscape 841.89 × 595.28 pt; duo prices independent in the PDF', () => {
  const s = readTalkerSettings({});
  const a = itemToTalkerContent(product('1', 'Coca-Cola 330ml', '1.25'), s);
  const b = itemToTalkerContent(product('2', 'Pepsi Max 500ml', '1.49'), s);
  const portrait = printPdf(composeTemplatePages(renderTemplate('T23', [a, b]), 1), 'T23');
  assertBox(portrait.boxes, 210, 297, 1);
  assert.ok(portrait.text.includes('£1.25') && portrait.text.includes('£1.49'));
  const landscape = printPdf(composeTemplatePages(renderTemplate('T24', [a]), 2), 'T24');
  assertBox(landscape.boxes, 297, 210, 2);
});

// ---------- Mixed and runner ----------
check('Mixed M05 PDF: A4, hero + compact labels at their cells, empty cells blank', () => {
  let state = changeLayout(readMixedState({}), 'M05');
  const i1 = product('1', 'Coca-Cola 330ml', '1.25');
  const i2 = product('2', 'Walkers Ready Salted', '0.89');
  state = addEntry(state, { ...newEntry('SHELF_8X3', 'T09'), itemId: i1.id }, 0);
  state = addEntry(state, { ...newEntry('SHELF_4X3', 'T17'), itemId: i2.id }, 3);
  const job = buildMixedJob(state, [i1, i2]);
  assert.equal(job.issues.length, 0);
  const pdf = printPdf(job.pages, 'mixed');
  assertBox(pdf.boxes, 210, 297, 1);
  assert.ok(pdf.text.includes('£1.25') && pdf.text.includes('£0.89'));
});

check('Shelf runner PDF: A4 landscape, strips 287 mm long in the raster', () => {
  const strip = renderRunner({ ...readRunnerSettings({}), headline: 'SALE', support: 'UP TO 50% OFF' });
  const pdf = printPdf(composeRunnerPages(strip, 4), 'runner');
  assertBox(pdf.boxes, 297, 210, 1);
  // Measure the red strip in the raster: first row of the page image.
  const py = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); w, h = im.size
y = int(${(5 + 39 / 2) * PX_PER_MM})
xs = [x for x in range(w) if (lambda p: p[0] > 200 and p[1] < 100 and p[2] < 100)(im.getpixel((x, y)))]
print(min(xs), max(xs))`;
  const [x0, x1] = execFileSync(ZX, ['-c', py, pdf.pngs[0]]).toString().trim().split(' ').map(Number);
  const lengthMm = (x1 - x0 + 1) / PX_PER_MM;
  assert.ok(near(lengthMm, 287, 0.5), `strip ${lengthMm.toFixed(2)} mm`);
});

check('Preview-only markers and sample fixtures never reach a PDF', () => {
  const unpriced = product('5060116211443', 'Tuscan Chicken Soup', null);
  const { out } = shelfJob([unpriced], 'standard', {}, 1);
  const pdf = printPdf(out, 'preview-only');
  assert.equal(pdf.text.includes('Needs price'), false);
  assert.equal(pdf.text.includes('Mud House'), false, 'no sample product');
  const empty = composeGridPages(paginate([], 21, SHEET), () => null, SHEET);
  assert.equal(empty[0].nodes.length, 0, 'zero products → nothing to ink');
});

check('Exact physical sizes are the source of truth (inch families not rounded)', () => {
  assert.deepEqual([LABEL_SIZES.SHELF_8X3.widthMm, LABEL_SIZES.SHELF_6X3.widthMm, LABEL_SIZES.SHELF_4X3.widthMm, LABEL_SIZES.SHELF_8X3.heightMm], [203.2, 152.4, 101.6, 76.2]);
  assert.ok(near(mmToPt(50), 141.732, 0.001) && near(mmToPt(30), 85.039, 0.001));
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
