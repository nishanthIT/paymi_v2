// Batch 8 verification: landing tools/tabs, shelf runner (no product, true
// size, pages, PDF), Recent/Saved library snapshots, draft previews for every
// tool, reopen round-trip, and honest Community / printer content.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch8-check.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSheetHtml } from '../src/features/labels/export/sheet-html.ts';
import { emptyDraft, parseStoredDraft } from '../src/features/labels/model/draft.ts';
import { applyLookupResult, createCustomItem, createPendingItem, setPriceText } from '../src/features/labels/model/label-item.ts';
import {
  addJob,
  addSaved,
  deleteSaved,
  draftStorageKey,
  duplicateSaved,
  formatWhen,
  libraryKeys,
  MAX_JOBS,
  renameSaved,
  sameDraftContent,
  toolInfo,
  validateName,
} from '../src/features/labels/model/library.ts';
import { addEntry, changeLayout, newEntry, readMixedState } from '../src/features/labels/model/mixed.ts';
import { LABEL_TOOLS, TEMPLATES } from '../src/features/labels/registry/manifest.ts';
import { mmToPt } from '../src/features/labels/registry/sizes.ts';
import { compositionToSvg } from '../src/features/labels/render/composition-svg.ts';
import { draftPreview, draftSummary, isDraftEmpty } from '../src/features/labels/render/draft-preview.ts';
import {
  composeRunnerPages,
  readRunnerSettings,
  renderRunner,
  RUNNER_PRESETS,
  runnerStripsPerPage,
  validateRunnerSize,
} from '../src/features/labels/render/shelf-runner.ts';
import { readShelfSettings } from '../src/features/labels/render/shelf-settings.ts';

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
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const inked = (c) => c.nodes.filter((n) => !n.previewOnly);
const texts = (c) => inked(c).filter((n) => n.kind === 'text').flatMap((n) => n.lines);
const product = (barcode, title, price, rrp = null) => {
  const item = applyLookupResult(createPendingItem(barcode), { id: barcode, title, rrp });
  return price ? setPriceText(item, price) : item;
};

// ---- Landing ----
check('Landing: six tools in exact order/copy; runner route is a real editor; four tabs in order', () => {
  assert.deepEqual(
    LABEL_TOOLS.map((t) => [t.title, t.description]),
    [
      ['SEL · Standard', 'Shelf edge label — name, price and barcode'],
      ['SEL · Promo', 'Shelf edge label for an offer — yellow stock or printed'],
      ['Reduced sticker', 'Markdown sticker that goes on the item itself'],
      ['Shelf talker', 'Card that sticks out from the shelf edge'],
      ['Shelf liner / Shelf runner', 'Long strip along the shelf edge — your message, no product'],
      ['Mixed size label', 'Different sizes together on one page'],
    ],
  );
  assert.equal(src('app/(app)/labels/runner.tsx').includes('ToolPlaceholder'), false);
  assert.equal(src('app/(app)/labels/mixed.tsx').includes('ToolPlaceholder'), false);
  const tabs = src('features/labels/components/labels-tabs.tsx');
  assert.ok(/'New'[\s\S]*'Recent'[\s\S]*'Saved'[\s\S]*'Community'/.test(tabs));
  const landing = src('app/(app)/labels/index.tsx');
  for (const tab of ['RecentTab', 'SavedTab', 'CommunityTab']) assert.ok(landing.includes(`<${tab}`), tab);
});

check('Every visible ellipsis opens a real menu (no inert ••• left)', () => {
  for (const file of ['app/(app)/labels/index.tsx', 'app/(app)/labels/shelf.tsx', 'app/(app)/labels/reduced.tsx', 'app/(app)/labels/template/[id].tsx', 'app/(app)/labels/runner.tsx', 'features/labels/components/tool-placeholder.tsx']) {
    assert.equal(/<HeaderEllipsis\s*\/>/.test(src(file)), false, file);
  }
  const menu = src('features/labels/components/labels-menu.tsx');
  for (const s of ['Save draft', 'Clear draft', 'Tap again to clear']) assert.ok(menu.includes(s), s);
  // Mixed sheet keeps its simple reference header (R01/R23 show no ellipsis).
  assert.equal(src('app/(app)/labels/mixed.tsx').includes('EditorMenu'), false);
});

// ---- Shelf runner ----
const runner = (patch = {}) => ({ ...readRunnerSettings({}), ...patch });

check('Runner needs no product; empty message → preview-only prompt, nothing but the stock colour inked', () => {
  const c = renderRunner(runner());
  assert.deepEqual([c.widthMm, c.heightMm], [287, 39]);
  assert.equal(texts(c).length, 0, 'no default message printed');
  assert.ok(c.nodes.some((n) => n.previewOnly && n.lines?.[0] === 'Add your message'));
  assert.deepEqual(c.warnings, ['Add a headline for the strip']);
  assert.equal(isDraftEmpty(emptyDraft('RUNNER')), true);
});

check('Red SALE strip: full-bleed red, white uppercase headline + support, inside the strip', () => {
  const c = renderRunner(runner({ headline: 'sale', support: 'up to 50% off', repeat: false }));
  const bg = c.nodes[0];
  assert.deepEqual([bg.kind, bg.fill, bg.xMm, bg.yMm, bg.wMm, bg.hMm], ['rect', '#F44236', 0, 0, 287, 39]);
  assert.deepEqual(texts(c), ['SALE', 'UP TO 50% OFF']);
  assert.ok(inked(c).filter((n) => n.kind === 'text').every((n) => n.colour === '#FFFFFF'));
  assert.equal(c.warnings.length, 0);
  for (const n of c.nodes.filter((x) => x.kind === 'text')) {
    assert.ok(n.xMm >= -EPS && n.xMm + n.wMm <= 287 + EPS && n.yMm >= 0 && n.yMm + n.lines.length * n.lineHeightMm <= 39 + EPS, n.lines[0]);
  }
  const head = c.nodes.find((n) => n.lines?.[0] === 'SALE');
  const sup = c.nodes.find((n) => n.lines?.[0] === 'UP TO 50% OFF');
  assert.ok(head.fontMm > sup.fontMm * 1.8, 'headline dominates');
  assert.ok(head.xMm + head.wMm <= sup.xMm, 'no overlap');
});

check('Repeat, colours, presets and custom sizes change the real artwork', () => {
  const one = renderRunner(runner({ headline: 'SALE', support: 'UP TO 50% OFF', repeat: false }));
  const many = renderRunner(runner({ headline: 'SALE', support: 'UP TO 50% OFF', repeat: true }));
  assert.equal(texts(one).filter((l) => l === 'SALE').length, 1);
  assert.ok(texts(many).filter((l) => l === 'SALE').length >= 2, 'repeats along 287 mm');
  const yellow = renderRunner(runner({ headline: 'SALE', background: 'yellow' }));
  assert.equal(yellow.nodes[0].fill, '#FFD60A');
  assert.equal(inked(yellow).find((n) => n.kind === 'text').colour, '#111111');
  const white = renderRunner(runner({ headline: 'SALE', background: 'white' }));
  assert.equal(white.nodes.some((n) => n.kind === 'rect' && !n.previewOnly), false, 'white stock = no ink fill');
  assert.deepEqual(RUNNER_PRESETS.map((p) => [p.widthMm, p.heightMm]), [[287, 39], [287, 30]]);
  const custom = renderRunner(runner({ presetId: 'custom', widthMm: 200, heightMm: 45, headline: 'NEW' }));
  assert.deepEqual([custom.widthMm, custom.heightMm], [200, 45]);
  assert.equal(validateRunnerSize(300, 39), 'Length must be 100–287 mm to print on A4 landscape');
  assert.equal(validateRunnerSize(287, 10), 'Height must be 20–60 mm');
  assert.equal(validateRunnerSize(287, 39), null);
});

check('Long runner text is reported, never ellipsised', () => {
  const c = renderRunner(runner({ headline: 'EVERYTHING MUST GO CLEARANCE', support: 'selected lines only while stocks last in this store today and tomorrow', repeat: false, widthMm: 120, heightMm: 30, presetId: 'custom' }));
  assert.ok(c.warnings.some((w) => /too long/.test(w)), c.warnings.join('; '));
  assert.equal(texts(c).some((l) => l.includes('…')), false);
});

check('Runner sheets: true-size strips on A4 landscape, no overlap, copies overflow to new pages', () => {
  const strip = renderRunner(runner({ headline: 'SALE', support: 'UP TO 50% OFF' }));
  assert.equal(runnerStripsPerPage(39), 4);
  assert.equal(runnerStripsPerPage(30), 6, '6 × 30 + 5 × 4 = 200 mm');
  const pages = composeRunnerPages(strip, 9);
  assert.equal(pages.length, 3);
  for (const p of pages) assert.deepEqual([p.widthMm, p.heightMm], [297, 210]);
  const bgs = pages[0].nodes.filter((n) => n.kind === 'rect' && n.fill === '#F44236');
  assert.equal(bgs.length, 4);
  for (const b of bgs) {
    assert.deepEqual([b.wMm, b.hMm], [287, 39], 'not scaled');
    assert.ok(b.xMm >= 0 && b.xMm + b.wMm <= 297 && b.yMm >= 0 && b.yMm + b.hMm <= 210);
  }
  for (let i = 1; i < bgs.length; i++) assert.ok(bgs[i].yMm >= bgs[i - 1].yMm + 39, 'stacked without overlap');
  assert.equal(pages[2].nodes.filter((n) => n.kind === 'rect' && n.fill === '#F44236').length, 1);
  assert.equal(compositionToSvg(pages[0]).includes('#A9C4EC'), false, 'cut outline is preview-only');
});

// ---- Library ----
const shelfDraft = () => {
  const d = emptyDraft('SEL_STANDARD');
  return { ...d, items: [product('5010511482313', 'Barratt Fruit Salad Duo', '0.99', '1.15')], settings: { design: 'standard', startAt: 21, widthRatio: 0.78 } };
};

check('Library keys are per shop + user and match the draft hook key', () => {
  const a = libraryKeys('7', 'shopA');
  const b = libraryKeys('7', 'shopB');
  assert.notEqual(a.saved, b.saved);
  assert.notEqual(a.jobs, b.jobs);
  assert.ok(draftStorageKey('7', 'shopA', 'MIXED').startsWith(a.draftPrefix));
  assert.equal(draftStorageKey('7', 'shopB', 'MIXED').startsWith(a.draftPrefix), false, 'another shop is out of scope');
  assert.equal(draftStorageKey('7', 'shopA', 'MIXED'), 'labels.draft.v1.shopA.7.MIXED', 'unchanged Batch 2 key');
});

check('Saved: snapshot is deep-copied; rename, duplicate (independent) and delete', () => {
  const draft = shelfDraft();
  let list = addSaved([], 'Crisps aisle', draft, 1000);
  draft.items[0].priceText = '9.99';
  draft.settings.startAt = 1;
  assert.equal(list[0].draft.items[0].priceText, '0.99', 'later edits never change the saved copy');
  assert.equal(list[0].draft.settings.startAt, 21);
  list = renameSaved(list, list[0].id, '  Sweets aisle ', 2000);
  assert.equal(list[0].name, 'Sweets aisle');
  list = duplicateSaved(list, list[0].id, 3000);
  assert.equal(list.length, 2);
  assert.equal(list[1].name, 'Sweets aisle (copy)');
  assert.notEqual(list[1].id, list[0].id);
  list[1].draft.items[0].priceText = '5.00';
  assert.equal(list[0].draft.items[0].priceText, '0.99', 'duplicate is independent');
  list = deleteSaved(list, list[0].id);
  assert.deepEqual(list.map((s) => s.name), ['Sweets aisle (copy)']);
  assert.equal(validateName('   '), 'Give it a name');
  assert.equal(validateName('x'.repeat(61)), 'Keep it to 60 characters');
});

check('Recent jobs: immutable page snapshot, newest first, capped', () => {
  const pages = composeRunnerPages(renderRunner(runner({ headline: 'SALE' })), 2);
  let jobs = [];
  const job = { toolId: 'RUNNER', title: 'Shelf liner', summary: 'SALE', output: 'sheet', pages, copies: 1, outcome: 'shared', draft: emptyDraft('RUNNER') };
  jobs = addJob(jobs, job, 1);
  pages[0].nodes.length = 0;
  assert.ok(jobs[0].pages[0].nodes.length > 0, 'job keeps the exact exported pages');
  for (let i = 0; i < MAX_JOBS + 5; i++) jobs = addJob(jobs, { ...job, summary: `#${i}` }, 10 + i);
  assert.equal(jobs.length, MAX_JOBS);
  assert.equal(jobs[0].summary, `#${MAX_JOBS + 4}`);
});

check('Every tool and all 29 templates map to their editor route', () => {
  assert.deepEqual(toolInfo('SEL_STANDARD'), { title: 'Shelf labels · Standard', pathname: '/(app)/labels/shelf', params: { mode: 'standard' } });
  assert.deepEqual(toolInfo('SEL_PROMO').params, { mode: 'promo' });
  assert.equal(toolInfo('REDUCED_STICKER').pathname, '/(app)/labels/reduced');
  assert.equal(toolInfo('MIXED').pathname, '/(app)/labels/mixed');
  assert.equal(toolInfo('RUNNER').pathname, '/(app)/labels/runner');
  for (const t of TEMPLATES) assert.deepEqual(toolInfo(`TEMPLATE_${t.id}`), { title: t.title, pathname: '/(app)/labels/template/[id]', params: { id: t.id } });
  assert.equal(toolInfo('TEMPLATE_T99'), null);
  assert.equal(toolInfo('SOMETHING'), null);
});

check('Timestamps read naturally (Today / Yesterday / date)', () => {
  const now = new Date(2026, 8, 25, 15, 0).getTime();
  assert.equal(formatWhen(new Date(2026, 8, 25, 9, 5).getTime(), now), 'Today, 09:05');
  assert.equal(formatWhen(new Date(2026, 8, 24, 18, 30).getTime(), now), 'Yesterday, 18:30');
  assert.equal(formatWhen(new Date(2026, 8, 12, 8, 0).getTime(), now), '12 Sept, 08:00');
  assert.equal(formatWhen(new Date(2025, 0, 3, 8, 0).getTime(), now), '3 Jan 2025, 08:00');
});

check('Draft summaries + previews for every tool use the real renderers at physical size', () => {
  const s = shelfDraft();
  assert.equal(isDraftEmpty(s), false);
  assert.match(draftSummary(s).summary, /^1 product · 1 label · Barratt Fruit Salad Duo$/);
  assert.deepEqual([draftPreview(s).widthMm, draftPreview(s).heightMm], [70, 38]);
  const reduced = { ...emptyDraft('REDUCED_STICKER'), items: [setPriceText(createCustomItem('5000168001357'), '7.99')], settings: {} };
  reduced.items[0].snapshot.displayName = 'Tuscan Soup';
  assert.equal(draftSummary(reduced).summary, 'Tuscan Soup · £7.99');
  assert.deepEqual([draftPreview(reduced).widthMm, draftPreview(reduced).heightMm], [50, 30]);
  assert.equal(isDraftEmpty({ ...emptyDraft('REDUCED_STICKER'), items: [createCustomItem()] }), true, 'the auto-created blank sticker is not "work"');
  const t13 = { ...emptyDraft('TEMPLATE_T13'), items: [product('1', 'Coca-Cola 330ml', '1.25')] };
  assert.deepEqual([draftPreview(t13).widthMm, draftPreview(t13).heightMm], [152.4, 76.2]);
  assert.ok(texts(draftPreview(t13)).includes('£1.25'));
  const a = product('1', 'Coke', '1.25');
  const b = product('2', 'Pepsi', '1.49');
  const t22 = { ...emptyDraft('TEMPLATE_T22'), items: [a, b], settings: { slots: [b.id, '', a.id] } };
  const t22p = texts(draftPreview(t22)).join('|');
  assert.ok(t22p.indexOf('£1.49') < t22p.indexOf('£1.25'), 'slot order kept');
  assert.equal(draftSummary(t22).title, 'Simple Trio · A4');
  let mixed = changeLayout(readMixedState({}), 'M02');
  mixed = addEntry(mixed, { ...newEntry('SHELF_6X3', 'T13'), itemId: a.id }, 1);
  const md = { ...emptyDraft('MIXED'), items: [a], settings: mixed };
  assert.equal(draftSummary(md).summary, '3 × 6 × 3 in · 1 label · Coke');
  assert.deepEqual([draftPreview(md).widthMm, draftPreview(md).heightMm], [210, 297]);
  const rd = { ...emptyDraft('RUNNER'), settings: { headline: 'SALE', support: 'UP TO 50% OFF' } };
  assert.equal(draftSummary(rd).summary, 'SALE · UP TO 50% OFF · 287 × 39 mm');
  assert.deepEqual([draftPreview(rd).widthMm, draftPreview(rd).heightMm], [287, 39]);
  assert.equal(draftPreview({ ...emptyDraft('TEMPLATE_T99'), items: [a] }), null, 'unknown shapes list without crashing');
});

check('Reopening a saved draft restores products, owner price, slots and settings exactly', () => {
  const draft = shelfDraft();
  const saved = addSaved([], 'Aisle 4', draft)[0];
  // openSnapshot writes the snapshot as the live draft; the editor hydrates via parseStoredDraft.
  const reopened = parseStoredDraft(JSON.stringify({ ...saved.draft, updatedAt: Date.now() }), 'SEL_STANDARD');
  assert.ok(sameDraftContent(reopened, draft));
  assert.equal(reopened.items[0].priceText, '0.99');
  assert.equal(reopened.items[0].priceEdited, true);
  assert.equal(reopened.items[0].snapshot.sourceRrpMinor, 115, 'catalogue RRP kept apart from the price');
  const settings = readShelfSettings('standard', reopened.settings);
  assert.equal(settings.startAt, 21);
  assert.equal(settings.widthRatio, 0.78);
  assert.equal(parseStoredDraft(JSON.stringify(saved.draft), 'SEL_PROMO'), null, 'a snapshot only opens in its own tool');
});

check('Community is an honest empty state: no fabricated templates, authors, likes or downloads; nothing published', () => {
  const tabs = src('features/labels/components/library-tabs.tsx');
  const community = tabs.slice(tabs.indexOf('export function CommunityTab'), tabs.indexOf('const styles'));
  assert.ok(community.includes('No community templates'));
  assert.ok(community.includes('nothing is shared'));
  assert.equal(/fetch\(|api\.|likes|downloads|author/i.test(community), false);
  assert.equal(/publish|share\(/i.test(src('features/labels/hooks/use-label-library.ts')), false, 'library never uploads');
});

check('Printer info is capability-based and lists no printer models', () => {
  const info = src('features/labels/components/printer-info.tsx');
  assert.ok(info.includes('Direct label printer') && info.includes('available: false'));
  assert.equal(/Brother|Zebra|DYMO|Munbyn|Rollo|Niimbot|Phomemo/i.test(info + src('features/labels/components/sticker-editor-parts.tsx')), false);
  assert.ok(src('features/labels/components/sticker-editor-parts.tsx').includes('<CapabilityList />'));
});

// ---- Real runner PDF ----
check('Runner PDF: A4 landscape pages (841.89 × 595.28 pt), count = packed pages', () => {
  const chromium = ['chromium', 'google-chrome'].find((bin) => {
    try {
      execFileSync('which', [bin]);
      return true;
    } catch {
      return false;
    }
  });
  assert.ok(chromium, 'headless Chromium not found');
  const dir = mkdtempSync(join(tmpdir(), 'labels-runner-'));
  const pages = composeRunnerPages(renderRunner(runner({ headline: 'SALE', support: 'UP TO 50% OFF' })), 6);
  writeFileSync(join(dir, 'r.html'), buildSheetHtml(pages));
  execFileSync(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(dir, 'r.pdf')}`, `file://${join(dir, 'r.html')}`], { stdio: 'ignore' });
  const raw = readFileSync(join(dir, 'r.pdf'), 'latin1');
  const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
  assert.equal(boxes.length, 2);
  for (const [w, h] of boxes) assert.ok(Math.abs(w - mmToPt(297)) < 1 && Math.abs(h - mmToPt(210)) < 1, `${w} × ${h}`);
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
