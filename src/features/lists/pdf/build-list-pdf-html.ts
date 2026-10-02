/**
 * Builds the A4 picking-sheet HTML for a shopping list.
 *
 * Layout contract: each shop starts a new page; its products flow Aisle →
 * Category → product down column 1, then column 2, then the next page
 * (CSS multi-column). Grouping matches Collect Mode's cheapest-shop assignment.
 */
import type { ListDetails, ListProduct } from '../types';
import { formatSizeLabel } from '@/utils/pack-size';
import { barcodeSvg } from './barcode-svg';

export interface PdfExportOptions {
  /** Shop id to render printable barcode images for, or null for none. */
  barcodeShopId: string | null;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(Number(value)) || Number(value) <= 0) return null;
  return `£${Number(value).toFixed(2)}`;
}

function sizeBadge(p: ListProduct): string | null {
  // Consistent "N × size" format used across the whole app.
  return formatSizeLabel({
    title: p.productName,
    packetSize: p.packetSize,
    retailSize: p.retailSize,
  });
}

function effectivePrice(p: ListProduct): number | null {
  const price = p.hasActiveOffer && p.offerPrice != null ? p.offerPrice : p.lowestPrice;
  return price > 0 ? price : null;
}

interface ShopGroup {
  shopId: string;
  shopName: string;
  aisles: { aisle: string; categories: { category: string; products: ListProduct[] }[] }[];
  productCount: number;
  estimatedCost: number;
}

function groupProducts(products: ListProduct[]): ShopGroup[] {
  const shopMap = new Map<string, ListProduct[]>();
  for (const p of products) {
    const key = p.shopId || 'unknown';
    const arr = shopMap.get(key) ?? [];
    arr.push(p);
    shopMap.set(key, arr);
  }

  const groups: ShopGroup[] = [];
  for (const [shopId, shopProducts] of shopMap) {
    const aisleMap = new Map<string, Map<string, ListProduct[]>>();
    for (const p of shopProducts) {
      const aisle = (p.aielNumber || p.locationCode || '').trim() || 'No aisle';
      const category = (p.category || '').trim() || 'Uncategorised';
      const catMap = aisleMap.get(aisle) ?? new Map<string, ListProduct[]>();
      const arr = catMap.get(category) ?? [];
      arr.push(p);
      catMap.set(category, arr);
      aisleMap.set(aisle, catMap);
    }

    const aisles = Array.from(aisleMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([aisle, catMap]) => ({
        aisle,
        categories: Array.from(catMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, prods]) => ({
            category,
            products: [...prods].sort((a, b) => a.productName.localeCompare(b.productName)),
          })),
      }));

    groups.push({
      shopId,
      shopName: shopProducts[0]?.shopName || 'Unknown shop',
      aisles,
      productCount: shopProducts.length,
      estimatedCost: shopProducts.reduce(
        (sum, p) => sum + (effectivePrice(p) ?? 0) * (p.quantity || 1),
        0,
      ),
    });
  }

  // Biggest shop first — matches Collect Mode's shop ordering.
  return groups.sort((a, b) => b.productCount - a.productCount);
}

function productBlock(p: ListProduct, withBarcodes: boolean, aisle: string): string {
  const size = sizeBadge(p);
  const price = money(effectivePrice(p));
  const productBc = withBarcodes && p.barcode ? barcodeSvg(p.barcode) : null;
  const caseBc = withBarcodes && p.caseBarcode ? barcodeSvg(p.caseBarcode) : null;

  // Row 1: name(+size) + qty + price. Row 2: barcode numbers + correct-price
  // box. Row 3 (barcode mode only): the scannable images.
  return `
  <div class="product">
    <span class="checkbox"></span>
    <div class="p-body">
      <div class="p-top">
        <span class="p-name">${esc(p.productName)}${size ? ` <span class="size">${esc(size)}</span>` : ''}</span>
        <span class="qty">×${p.quantity || 1}</span>
        <span class="price-now${p.hasActiveOffer && price ? ' offer' : ''}">${price ?? '—'}</span>
      </div>
      <div class="p-meta">
        ${aisle !== 'No aisle' ? `<span class="aisle-tag">A${esc(aisle)}</span>` : ''}
        <span class="code-num">${esc(p.barcode || '—')}</span>
        ${p.caseBarcode ? `<span class="code-num case">C:${esc(p.caseBarcode)}</span>` : ''}
        <span class="price-fix">£<span class="price-box"></span></span>
      </div>
      ${
        withBarcodes
          ? `<div class="bc-row">
        <div class="bc">${productBc ?? ''}</div>
        <div class="bc">${caseBc ?? ''}</div>
      </div>`
          : ''
      }
    </div>
  </div>`;
}

function shopPage(
  group: ShopGroup,
  index: number,
  listName: string,
  exportDate: string,
  options: PdfExportOptions,
): string {
  const withBarcodes = options.barcodeShopId != null && options.barcodeShopId === group.shopId;
  const cost = group.estimatedCost > 0 ? `£${group.estimatedCost.toFixed(2)}` : '—';
  const shopName = esc(group.shopName);

  // Flat sequence of blocks so the column flow never splits a header from
  // its first product. Aisle bars repeat the shop name for continuation pages.
  const blocks = group.aisles
    .map((aisleGroup) => {
      const aisleText = aisleGroup.aisle === 'No aisle' ? 'NO AISLE MAPPED' : `AISLE ${esc(aisleGroup.aisle)}`;
      const categories = aisleGroup.categories
        .map(
          (cat) => `
      <div class="cat-label">${esc(cat.category)}</div>
      ${cat.products.map((p) => productBlock(p, withBarcodes, aisleGroup.aisle)).join('')}`,
        )
        .join('');
      return `
    <div class="aisle-label"><span>${aisleText}</span><span class="aisle-shop">${shopName}</span></div>
    ${categories}`;
    })
    .join('');

  return `
  <section class="shop${index > 0 ? ' page-break' : ''}">
    <header class="shop-header">
      <h1 class="shop-name">${shopName}</h1>
      <div class="shop-meta">
        ${withBarcodes ? '<span class="bc-flag">SCANNABLE</span><span class="dot">·</span>' : ''}
        <span class="list-name">${esc(listName)}</span>
        <span class="dot">·</span>
        <span><b>${group.productCount}</b> products</span>
        <span class="dot">·</span>
        <span>Est. <b>${cost}</b></span>
        <span class="dot">·</span>
        <span>${esc(exportDate)}</span>
      </div>
    </header>
    <div class="cols">${blocks}
      <div class="doc-footer">
        <span>Generated by Paymi</span>
        <span>Tick items as collected · write corrected prices in the boxes</span>
      </div>
    </div>
  </section>`;
}

/**
 * iOS's WebKit print renderer doesn't fragment CSS columns across pages, so
 * the sheet is packed into fixed A4 page boxes with two real columns using
 * measured heights. Without JS (Android's WebView) the CSS multicol layout,
 * which Chromium paginates identically, is left in place.
 */
const PAGINATE_SCRIPT = `(function () {
  var shops = [].slice.call(document.querySelectorAll('section.shop'));
  if (!shops.length) return;
  var root = document.documentElement;
  var out = document.createElement('div');
  var pageStyle = document.createElement('style');
  pageStyle.textContent = '@page { size: A4; margin: 0; }';
  try {
    root.className += ' paged';
    document.head.appendChild(pageStyle);
    document.body.appendChild(out);
    var pages = [];
    var newPage = function (header) {
      var page = document.createElement('div');
      page.className = 'page';
      if (header) page.appendChild(header);
      var cols = document.createElement('div');
      cols.className = 'page-cols';
      var a = document.createElement('div');
      var b = document.createElement('div');
      a.className = b.className = 'col';
      cols.appendChild(a);
      cols.appendChild(b);
      page.appendChild(cols);
      out.appendChild(page);
      pages.push(page);
      return [a, b];
    };
    var isHeading = function (el) {
      return /(^| )(aisle-label|cat-label)( |$)/.test(el.className);
    };
    shops.forEach(function (shop) {
      var header = shop.querySelector('.shop-header').cloneNode(true);
      var blocks = [].slice.call(shop.querySelector('.cols').children);
      // Headings travel with the item after them so they are never orphaned.
      var units = [], cur = [];
      blocks.forEach(function (el) {
        cur.push(el.cloneNode(true));
        if (!isHeading(el)) { units.push(cur); cur = []; }
      });
      if (cur.length) units.push(cur);
      var cols = newPage(header), ci = 0;
      units.forEach(function (unit) {
        var col = cols[ci];
        unit.forEach(function (el) { col.appendChild(el); });
        if (col.scrollHeight > col.clientHeight + 1 && col.children.length > unit.length) {
          if (ci === 0) { ci = 1; } else { cols = newPage(null); ci = 0; }
          unit.forEach(function (el) { cols[ci].appendChild(el); });
        }
      });
    });
    pages[pages.length - 1].className += ' last';
    shops.forEach(function (shop) { shop.parentNode.removeChild(shop); });
  } catch (e) {
    if (out.parentNode) out.parentNode.removeChild(out);
    if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
    root.className = root.className.replace(' paged', '');
  }
})();`;

export function buildListPdfHtml(list: ListDetails, options: PdfExportOptions): string {
  const products = list.products ?? [];
  const groups = groupProducts(products);
  const exportDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const listName = list.name || 'Shopping List';
  const pages = groups.map((g, i) => shopPage(g, i, listName, exportDate, options)).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* Print tuning knobs — adjust these to trade density for readability. */
  :root {
    --fs: 9.5px;          /* product name / price */
    --fs-small: 8px;      /* barcode numbers, labels */
    --col-gap: 4mm;       /* gutter between the two columns */
    --row-pad: 1.5px;     /* vertical padding per product */
    --tick: 11px;         /* checkbox size */
    --price-w: 40px;      /* fixed price column so prices line up */
  }
  @page { size: A4; margin: 6mm 5mm; }
  * { margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #222; background: #fff; font-size: var(--fs); line-height: 1.2;
  }

  .page-break { break-before: page; page-break-before: always; }
  .shop-header { display: flex; justify-content: space-between; align-items: baseline; gap: 6px;
    border-bottom: 1.5px solid #222; padding: 0 1px 2px; margin-bottom: 3px; }
  .shop-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .bc-flag { font-size: 7px; font-weight: 800; border: 1px solid #777; border-radius: 2px;
    padding: 0 4px; letter-spacing: 0.5px; }
  .shop-meta { flex: 0 0 auto; font-size: 8.5px; color: #555; white-space: nowrap; }
  .shop-meta b { font-size: 9.5px; color: #222; }
  .list-name { font-weight: 700; color: #222; }
  .dot { margin: 0 3px; }

  /* Column-first flow: fill column 1 top→bottom, then column 2, then next page. */
  .cols { column-count: 2; column-gap: var(--col-gap); column-rule: 0.5px solid #bbb;
    column-fill: auto; }

  .aisle-label { display: flex; justify-content: space-between; gap: 4px;
    background: #4a4a4a; color: #fff; font-size: 8.5px; font-weight: 800;
    letter-spacing: 0.8px; padding: 1px 4px; margin: 3px 0 1px;
    break-inside: avoid; break-after: avoid; page-break-after: avoid; }
  .cols > .aisle-label:first-child { margin-top: 0; }
  .aisle-shop { font-weight: 600; letter-spacing: 0.3px; opacity: 0.85; text-transform: uppercase;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .cat-label { font-size: var(--fs-small); font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.5px; color: #555; border-bottom: 0.5px solid #999; padding: 1px 1px 0;
    break-inside: avoid; break-after: avoid; page-break-after: avoid; }

  .product { display: flex; align-items: flex-start; gap: 4px;
    padding: var(--row-pad) 1px; border-bottom: 0.5px solid #d0d0d0;
    break-inside: avoid; page-break-inside: avoid; }
  .checkbox { flex: 0 0 auto; width: var(--tick); height: var(--tick); margin-top: 1px;
    border: 1.2px solid #444; border-radius: 1.5px; background: #fff; }
  .p-body { flex: 1 1 auto; min-width: 0; }

  .p-top { display: flex; align-items: baseline; gap: 4px; }
  .p-name { flex: 1 1 auto; min-width: 0; font-size: var(--fs); font-weight: 700;
    overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden; }
  .size { display: inline-block; font-size: var(--fs-small); font-weight: 800;
    border: 0.5px solid #999; padding: 0 2px; white-space: nowrap; }
  .qty { flex: 0 0 auto; font-size: 12px; font-weight: 900; line-height: 1; }
  .price-now { flex: 0 0 var(--price-w); text-align: right; font-size: 10.5px; font-weight: 800;
    font-variant-numeric: tabular-nums; white-space: nowrap; color: #000; }
  .price-now.offer { text-decoration: underline; text-decoration-thickness: 1px; }

  .p-meta { display: flex; align-items: center; gap: 4px; margin-top: 1px; }
  .code-num { font-size: var(--fs-small); font-weight: 700; font-family: 'Courier New', monospace;
    letter-spacing: 0.2px; white-space: nowrap; }
  .code-num.case { color: #555; }
  .aisle-tag { font-size: var(--fs-small); font-weight: 800; border: 0.5px solid #777;
    border-radius: 1.5px; padding: 0 2px; white-space: nowrap; }
  .price-fix { display: flex; align-items: center; margin-left: auto;
    font-size: var(--fs-small); font-weight: 700; color: #555; }
  .price-box { display: inline-block; width: var(--price-w); height: 11px; border: 0.5px solid #999;
    margin-left: 1px; background: #fff; }

  .bc-row { display: flex; gap: 4px; margin-top: 1px; }
  .bc { flex: 1 1 0; min-width: 0; height: 20px; overflow: hidden; }

  .doc-footer { margin-top: 3px; padding-top: 2px; border-top: 0.5px solid #999;
    font-size: 7px; color: #555; display: flex; justify-content: space-between; gap: 4px;
    break-inside: avoid; }

  /* Explicit A4 pages built by PAGINATE_SCRIPT (296mm leaves slack for engine rounding). */
  html.paged, html.paged body { width: 210mm; }
  .page { width: 210mm; height: 296mm; padding: 6mm 5mm; display: flex; flex-direction: column;
    overflow: hidden; page-break-after: always; break-after: page; }
  .page.last { page-break-after: auto; break-after: auto; }
  .page > .shop-header { flex: 0 0 auto; }
  .page-cols { flex: 1 1 auto; min-height: 0; display: flex; }
  .col { flex: 1 1 0; min-width: 0; overflow: hidden; }
  .col:first-child { padding-right: calc(var(--col-gap) / 2); border-right: 0.5px solid #bbb; }
  .col + .col { padding-left: calc(var(--col-gap) / 2); }
  .col > .aisle-label:first-child { margin-top: 0; }
</style>
</head>
<body>
  ${pages || '<p style="padding:20px;text-align:center;">This list is empty.</p>'}
  <script>${PAGINATE_SCRIPT}</script>
</body>
</html>`;
}
