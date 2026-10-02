// Batch 6 verification: A4 catalogue T20–T29 — exact text/order/section/sizes,
// orientation + product-count chips, independent duo/trio slots, same-product
// twin photos, pricing rules and page safety; plus the full 29-template catalogue.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-batch6-check.mjs
import assert from 'node:assert/strict';

import { applyLookupResult, createPendingItem, setPriceText } from '../src/features/labels/model/label-item.ts';
import { TEMPLATE_FIELDS, TEMPLATE_ICONS } from '../src/features/labels/registry/catalogue-meta.ts';
import { TEMPLATES } from '../src/features/labels/registry/manifest.ts';
import { LABEL_SIZES, mmToPt } from '../src/features/labels/registry/sizes.ts';
import { POSTER_TEMPLATE_IDS } from '../src/features/labels/render/a4-posters.ts';
import { itemToTalkerContent, readTalkerSettings } from '../src/features/labels/render/talker-settings.ts';
import { hasTemplateRenderer, renderTemplate, renderTemplateFixture, slotCount } from '../src/features/labels/render/templates.ts';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, error.message]);
  }
}

// Transcribed from spec §7 and R05–R08: id, title, subtitle, orientation, product slots.
const REFERENCE = [
  ['T20', 'Hero Poster · A4', 'Full-page A4 · banner + massive price + product hero', 'portrait', 1],
  ['T21', 'Triptych · A4', 'A4 · 3 products stacked · price circle + image', 'portrait', 3],
  ['T22', 'Simple Trio · A4', 'A4 · 3 products side-by-side · one price under each', 'portrait', 3],
  ['T23', 'Stacked Duo · A4', 'A4 portrait · 2 products stacked top/bottom', 'portrait', 2],
  ['T24', 'Hero Landscape · A4', 'A4 landscape · image left, price + name right', 'landscape', 1],
  ['T25', 'Duo Landscape · A4', 'A4 landscape · 2 products side-by-side', 'landscape', 2],
  ['T26', 'Strip Landscape · A4', 'A4 landscape · 3 products in one row', 'landscape', 3],
  ['T27', 'Ribbon Hero · Landscape', 'A4 landscape · red ribbon · twin product photos · italic ONLY £X.XX', 'landscape', 1],
  ['T28', 'Bold Title · Landscape', 'A4 landscape · red ribbon · huge red title · twin photos + price', 'landscape', 1],
  ['T29', 'Price Hero · Landscape', 'A4 landscape · minimal · huge price above, large product photo below', 'landscape', 1],
];
const IDS = REFERENCE.map((r) => r[0]);
const MULTI = REFERENCE.filter((r) => r[4] > 1).map((r) => r[0]);
const texts = (c) => c.nodes.filter((n) => n.kind === 'text').flatMap((n) => n.lines);
const inkedTexts = (c) => c.nodes.filter((n) => n.kind === 'text' && !n.previewOnly).flatMap((n) => n.lines);
const settings = readTalkerSettings({});

function product(barcode, title, rrp, price, extra = {}) {
  let item = applyLookupResult(createPendingItem(barcode), { id: barcode, title, rrp });
  item = { ...item, snapshot: { ...item.snapshot, ...extra } };
  return price ? setPriceText(item, price) : item;
}
const coke = () => product('5449000000996', 'Coca-Cola Original Taste 330ml', '1.35', '1.25', { imageUri: 'file:///coke.jpg' });
const pepsi = () => product('4060800001306', 'Pepsi Max 500ml', '1.65', '1.49', { imageUri: 'file:///pepsi.jpg' });
const walkers = () => product('5000328657962', 'Walkers Ready Salted 45g', '1.10', '0.89', { imageUri: 'file:///walkers.jpg' });
const content = (item) => itemToTalkerContent(item, settings);

check('Catalogue has all 29 templates T01–T29 in order, each with a renderer, icon and field spec', () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), Array.from({ length: 29 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`));
  for (const t of TEMPLATES) {
    assert.ok(hasTemplateRenderer(t.id), `${t.id} renderer`);
    assert.ok(TEMPLATE_ICONS[t.id], `${t.id} icon`);
    assert.ok(TEMPLATE_FIELDS[t.id], `${t.id} fields`);
    assert.doesNotThrow(() => renderTemplateFixture(t.id), t.id);
  }
});

check('A4 templates in exact reference order with exact title/subtitle/section/orientation/slots', () => {
  const actual = TEMPLATES.slice(19).map((t) => [t.id, t.title, t.subtitle, t.orientation, t.productSlots]);
  assert.deepEqual(actual, REFERENCE);
  assert.ok(TEMPLATES.slice(19).every((t) => t.section === 'A4'));
  assert.deepEqual(POSTER_TEMPLATE_IDS, IDS);
  assert.deepEqual([...new Set(TEMPLATES.map((t) => t.section))].at(-1), 'A4', 'A4 section is last (after 4 × 3 in)');
});

check('Exact A4 sizes: portrait 210 × 297 mm, landscape 297 × 210 mm (595.3 × 841.9 pt)', () => {
  for (const [id, , , orientation] of REFERENCE) {
    const c = renderTemplateFixture(id);
    assert.deepEqual([c.widthMm, c.heightMm], orientation === 'portrait' ? [210, 297] : [297, 210], id);
  }
  assert.ok(Math.abs(mmToPt(LABEL_SIZES.A4_PORTRAIT.widthMm) - 595.28) < 0.01);
  assert.ok(Math.abs(mmToPt(LABEL_SIZES.A4_PORTRAIT.heightMm) - 841.89) < 0.01);
});

check('Chips: every A4 row has Portrait/Landscape; "N products" only on duo/trio (T21, T22, T23, T25, T26)', () => {
  const chips = (t) => [t.orientation === 'portrait' ? 'Portrait' : 'Landscape', ...(t.productSlots > 1 ? [`${t.productSlots} products`] : [])];
  assert.deepEqual(
    Object.fromEntries(TEMPLATES.slice(19).map((t) => [t.id, chips(t)])),
    {
      T20: ['Portrait'],
      T21: ['Portrait', '3 products'],
      T22: ['Portrait', '3 products'],
      T23: ['Portrait', '2 products'],
      T24: ['Landscape'],
      T25: ['Landscape', '2 products'],
      T26: ['Landscape', '3 products'],
      T27: ['Landscape'],
      T28: ['Landscape'],
      T29: ['Landscape'],
    },
  );
  assert.deepEqual(MULTI, ['T21', 'T22', 'T23', 'T25', 'T26']);
  for (const id of IDS) assert.equal(slotCount(id), REFERENCE.find((r) => r[0] === id)[4]);
});

check('Icon categories: megaphone, stack/columns, trophy, T, dark tag', () => {
  assert.equal(TEMPLATE_ICONS.T20.icon, 'bullhorn');
  assert.equal(TEMPLATE_ICONS.T27.icon, 'trophy');
  assert.equal(TEMPLATE_ICONS.T28.icon, 'format-title');
  assert.deepEqual(TEMPLATE_ICONS.T29, { icon: 'tag', tone: 'dark' });
  for (const id of MULTI) assert.match(TEMPLATE_ICONS[id].icon, /view-/, id);
  assert.equal(TEMPLATE_ICONS.T25.tone, 'purple');
});

check('Fixture artwork: Sample product 1/2/3 at £1.99/£2.99/£3.99 on multi designs; single designs £1.99; no warnings', () => {
  for (const [id, , , , slots] of REFERENCE) {
    const c = renderTemplateFixture(id);
    const all = texts(c).join(' | ');
    const flowing = texts(c).join(' ').toLowerCase();
    assert.equal(c.warnings.length, 0, `${id}: ${c.warnings.join('; ')}`);
    if (slots === 1) {
      assert.ok(/£1\.99/.test(all), `${id} price`);
      assert.ok(/SAMPLE PRODUCT|Sample product/.test(all), `${id} name`);
    } else {
      ['£1.99', '£2.99', '£3.99'].slice(0, slots).forEach((p, k) => {
        assert.ok(all.includes(p), `${id} ${p}`);
        assert.ok(flowing.includes(`sample product ${k + 1}`), `${id} name ${k + 1}`);
      });
    }
  }
});

check('Structure: banners (WOW red / Duo purple), Triptych dark-blue page, orange headings, round badges, T29 top-right badge', () => {
  const has = (id, pred) => renderTemplateFixture(id).nodes.some(pred);
  const redDiscs = (id) =>
    renderTemplateFixture(id).nodes.filter((n) => n.kind === 'rect' && n.fill === '#F44236' && n.wMm === n.hMm && n.radiusMm >= n.wMm / 2 - 0.01 && n.wMm > 15).length;
  assert.ok(has('T20', (n) => n.kind === 'rect' && n.fill === '#F44236') && texts(renderTemplateFixture('T20')).includes('WOW'));
  assert.ok(has('T20', (n) => n.kind === 'text' && n.colour === '#F2702A' && n.lines[0] === 'SAMPLE PRODUCT'));
  assert.ok(has('T21', (n) => n.kind === 'rect' && n.fill === '#1E3FA0' && n.hMm > 200));
  assert.equal(redDiscs('T21'), 3, 'three red price circles');
  assert.ok(has('T25', (n) => n.kind === 'rect' && n.fill === '#5B34C9'));
  assert.equal(redDiscs('T26'), 3, 'three round badges');
  assert.equal(renderTemplateFixture('T25').nodes.filter((n) => n.kind === 'text' && n.colour === '#F44236' && /^£\d/.test(n.lines[0])).length, 2, 'Duo prices red');
  assert.ok(has('T27', (n) => n.kind === 'text' && n.colour === '#F2702A'), 'T27 orange title');
  assert.ok(has('T28', (n) => n.kind === 'text' && n.colour === '#F44236' && n.fontMm >= 15), 'T28 huge red title');
  const t29 = renderTemplateFixture('T29');
  const badge = t29.nodes.find((n) => n.kind === 'rect' && n.fill === '#F44236');
  assert.ok(badge.xMm > t29.widthMm * 0.8 && badge.yMm < 20 && badge.wMm < 30, 'small top-right badge');
  const price = t29.nodes.find((n) => n.kind === 'price' || (n.kind === 'text' && n.lines[0] === '£1.99'));
  assert.ok(price.yMm < 40 && (price.fontMm ?? 0) >= 30, 'huge price at top');
});

check('Duo/trio: each slot prints its own product and owner price (never RRP)', () => {
  const items = [coke(), pepsi(), walkers()];
  for (const id of MULTI) {
    const n = slotCount(id);
    const c = renderTemplate(id, items.slice(0, n).map(content));
    const all = inkedTexts(c).join(' | ');
    ['£1.25', '£1.49', '£0.89'].slice(0, n).forEach((p) => assert.ok(all.includes(p), `${id} ${p}`));
    ['£1.35', '£1.65', '£1.10'].forEach((rrp) => assert.equal(all.includes(rrp), false, `${id} RRP ${rrp}`));
    assert.ok(/Coca-Cola|COCA-COLA/.test(all) && /Pepsi|PEPSI/.test(all), `${id} names`);
    const uris = c.nodes.filter((x) => x.kind === 'image').map((x) => x.uri);
    assert.deepEqual(uris, ['file:///coke.jpg', 'file:///pepsi.jpg', 'file:///walkers.jpg'].slice(0, n), `${id} photos in slot order`);
  }
});

check('Slots are independent: changing product 2 leaves products 1 and 3 unchanged', () => {
  for (const id of ['T22', 'T26', 'T21']) {
    const a = renderTemplate(id, [coke(), pepsi(), walkers()].map(content));
    const b = renderTemplate(id, [coke(), setPriceText(pepsi(), '2.50'), walkers()].map(content));
    const ta = inkedTexts(a).join('|');
    const tb = inkedTexts(b).join('|');
    assert.ok(ta.includes('£1.49') && !tb.includes('£1.49') && tb.includes('£2.50'), id);
    assert.ok(tb.includes('£1.25') && tb.includes('£0.89'), `${id} others kept`);
  }
});

check('Empty slot → preview-only "Add product N"; nothing inked; filled slots unaffected', () => {
  for (const id of MULTI) {
    const n = slotCount(id);
    const c = renderTemplate(id, [content(coke()), null, null].slice(0, n));
    for (let k = 1; k < n; k++) {
      const marker = c.nodes.find((x) => x.kind === 'text' && x.lines[0] === `Add product ${k + 1}`);
      assert.ok(marker?.previewOnly, `${id} slot ${k + 1} preview-only`);
    }
    assert.ok(inkedTexts(c).join('|').includes('£1.25'), `${id} slot 1 kept`);
    assert.equal(c.nodes.filter((x) => x.kind === 'image').length, 1, `${id} no sample art in empty slots`);
  }
});

check('Twin photos (T27, T28) are the same product: two image nodes, identical URI, one price', () => {
  for (const id of ['T27', 'T28']) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    assert.equal(tpl.twinPhotoSharedProduct, true);
    assert.equal(tpl.productSlots, 1);
    const c = renderTemplate(id, [content(coke()), content(pepsi())]);
    const imgs = c.nodes.filter((n) => n.kind === 'image');
    assert.equal(imgs.length, 2, id);
    assert.equal(imgs[0].uri, imgs[1].uri, `${id} same product both sides`);
    assert.equal(inkedTexts(c).join('|').includes('Pepsi'), false, `${id} ignores a second product`);
    assert.ok(imgs[0].xMm < c.widthMm / 2 && imgs[1].xMm > c.widthMm / 2, `${id} left + right`);
  }
});

check('Ribbon Hero italic "ONLY £X.XX" when priced; omitted when no price', () => {
  const c = renderTemplate('T27', [content(coke())]);
  const only = c.nodes.find((n) => n.kind === 'text' && n.lines[0] === 'ONLY');
  assert.ok(only?.italic, 'italic ONLY');
  assert.ok(texts(c).includes('£1.25'));
  const none = renderTemplate('T27', [content(product('5060116211443', 'Tuscan Chicken Soup', null))]);
  assert.equal(texts(none).includes('ONLY'), false);
});

check('Missing price → preview-only "Needs price" in that slot, never inked £0.00', () => {
  const noPrice = content(product('5060116211443', 'Tuscan Chicken Soup', null));
  for (const [id, , , , slots] of REFERENCE) {
    const c = renderTemplate(id, [noPrice, content(pepsi()), content(walkers())].slice(0, slots));
    assert.equal(JSON.stringify(c.nodes.filter((n) => !n.previewOnly)).includes('£0.00'), false, id);
    assert.ok(c.nodes.some((n) => n.previewOnly && n.lines?.[0] === 'Needs price'), `${id} marker`);
    if (slots > 1) assert.ok(inkedTexts(c).join('|').includes('£1.49'), `${id} other slots still priced`);
  }
});

check('No photo on a real product → no sample fixture art substituted', () => {
  const plain = content(product('5010511482313', 'Barratt Fruit Salad Duo', '1.15', '0.99'));
  for (const [id, , , , slots] of REFERENCE) {
    const c = renderTemplate(id, Array(slots).fill(plain));
    assert.equal(c.nodes.some((n) => n.kind === 'image'), false, id);
    assert.equal(c.nodes.some((n) => n.kind === 'rect' && ['#FBEADF', '#E4EEFB', '#E7F2E3'].includes(n.fill)), false, `${id} fixture tiles`);
    assert.ok(inkedTexts(c).join('|').includes('£0.99'), `${id} price`);
  }
});

check('Badge text override and small print are shared across the poster', () => {
  const c = renderTemplate('T22', [coke(), pepsi(), walkers()].map(content), { headline: 'Half price', footer: 'While stocks last' });
  assert.ok(texts(c).includes('HALF PRICE'));
  assert.ok(texts(c).includes('While stocks last'));
  const plain = renderTemplate('T22', [coke(), pepsi(), walkers()].map(content));
  assert.equal(plain.nodes.some((n) => n.kind === 'rect' && n.fill === '#D9DADE'), false, 'no footer placeholder on real posters');
});

check('Long names are reported, not ellipsised, on every A4 design', () => {
  const long = content(
    product('5010511482313', 'Extraordinarily Long Premium Assorted Fruit Flavour Chewy Sweets Sharing Bag Limited Edition Mega Size Multipack With Extra Free Sweets Inside Every Single Bag For The Whole Family To Share This Summer', '1.15', '0.99'),
  );
  for (const [id, , , , slots] of REFERENCE) {
    const c = renderTemplate(id, Array(slots).fill(long));
    assert.ok(c.warnings.some((w) => /too long/.test(w)), `${id} should warn`);
    assert.equal(texts(c).some((l) => l.includes('…')), false, `${id} no ellipsis`);
  }
});

check('All nodes stay inside the A4 page and do not overlap across slots (fixture + real)', () => {
  const real = [coke(), pepsi(), walkers()].map(content);
  const twoLine = content(product('5449000000996', 'Coca-Cola Original Taste Zero Sugar 330ml Can', '1.35', '1.25', { imageUri: 'file:///c.jpg' }));
  for (const [id, , , , slots] of REFERENCE) {
    for (const cs of [null, real.slice(0, slots), Array(slots).fill(twoLine)]) {
      const c = cs ? renderTemplate(id, cs) : renderTemplateFixture(id);
      for (const n of c.nodes.filter((x) => 'wMm' in x)) {
        assert.ok(n.xMm >= -0.01 && n.xMm + n.wMm <= c.widthMm + 0.01, `${id} ${n.kind} x`);
        const h = n.kind === 'text' ? n.lines.length * n.lineHeightMm : n.hMm ?? 0;
        assert.ok(n.yMm >= -0.01 && n.yMm + h <= c.heightMm + 0.01, `${id} ${n.kind} y`);
      }
      // Headings never run into the photos below them.
      const imgs = c.nodes.filter((n) => n.kind === 'image');
      const heads = c.nodes.filter((n) => n.kind === 'text' && n.fontMm >= 10 && !n.lines[0].startsWith('£'));
      for (const h of heads) {
        for (const img of imgs) {
          const overlapX = h.xMm < img.xMm + img.wMm && img.xMm < h.xMm + h.wMm;
          const overlapY = h.yMm < img.yMm + img.hMm && img.yMm < h.yMm + h.lines.length * h.lineHeightMm;
          if (overlapX && overlapY) assert.fail(`${id} heading "${h.lines[0]}" overlaps a photo`);
        }
      }
    }
  }
});

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
