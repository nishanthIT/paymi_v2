/**
 * Builds the A4 picking-sheet HTML for a shopping list.
 *
 * Layout contract (strict): TWO product blocks per row, always. Products are
 * grouped Shop → Aisle → Category (same grouping Collect Mode derives from
 * the backend's cheapest-shop assignment) and each shop starts a new page.
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

function productBlock(p: ListProduct, withBarcodes: boolean): string {
  const size = sizeBadge(p);
  const price = money(effectivePrice(p));
  const productBc = withBarcodes && p.barcode ? barcodeSvg(p.barcode) : null;
  const caseBc = withBarcodes && p.caseBarcode ? barcodeSvg(p.caseBarcode) : null;

  // Row 1: checkbox + name(+size) + qty + price. Row 2: barcode numbers +
  // correct-price box. Row 3 (barcode mode only): the scannable images.
  return `
  <div class="product">
    <div class="p-top">
      <span class="checkbox"></span>
      <span class="p-name">${esc(p.productName)}${size ? ` <span class="size">${esc(size)}</span>` : ''}</span>
      <span class="qty">×${p.quantity || 1}</span>
      <span class="price-now">${price ?? '—'}</span>
    </div>
    <div class="p-meta">
      <span class="code-num">${esc(p.barcode || '—')}</span>
      ${p.caseBarcode ? `<span class="code-num case">C:${esc(p.caseBarcode)}</span>` : ''}
      <span class="price-fix">£<span class="price-box"></span></span>
    </div>
    ${
      productBc || caseBc
        ? `<div class="bc-row">
      ${productBc ? `<div class="bc">${productBc}</div>` : ''}
      ${caseBc ? `<div class="bc">${caseBc}</div>` : ''}
    </div>`
        : ''
    }
  </div>`;
}

function shopPage(group: ShopGroup, index: number, exportDate: string, options: PdfExportOptions): string {
  const withBarcodes = options.barcodeShopId != null && options.barcodeShopId === group.shopId;
  const cost = group.estimatedCost > 0 ? `£${group.estimatedCost.toFixed(2)}` : '—';

  const sections = group.aisles
    .map((aisleGroup) => {
      const categories = aisleGroup.categories
        .map(
          (cat) => `
      <div class="cat-label">${esc(cat.category)}</div>
      <div class="grid">
        ${cat.products.map((p) => productBlock(p, withBarcodes)).join('')}
      </div>`,
        )
        .join('');
      return `
    <div class="aisle">
      <div class="aisle-label">${aisleGroup.aisle === 'No aisle' ? 'NO AISLE MAPPED' : `AISLE ${esc(aisleGroup.aisle)}`}</div>
      ${categories}
    </div>`;
    })
    .join('');

  return `
  <section class="shop${index > 0 ? ' page-break' : ''}">
    <header class="shop-header">
      <div class="shop-title-row">
        <h1 class="shop-name">${esc(group.shopName)}</h1>
        <div class="shop-meta">
          ${withBarcodes ? '<span class="bc-flag">SCANNABLE</span><span class="dot">·</span>' : ''}
          <span><b>${group.productCount}</b> products</span>
          <span class="dot">·</span>
          <span>Est. <b>${cost}</b></span>
          <span class="dot">·</span>
          <span>${esc(exportDate)}</span>
        </div>
      </div>
    </header>
    ${sections}
  </section>`;
}

export function buildListPdfHtml(list: ListDetails, options: PdfExportOptions): string {
  const products = list.products ?? [];
  const groups = groupProducts(products);
  const exportDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const pages = groups.map((g, i) => shopPage(g, i, exportDate, options)).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 5mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; }
  html, body {
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #333; background: #fff; font-size: 9.5px; line-height: 1.2;
  }

  .doc-header { display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 1.5px solid #666; padding-bottom: 2px; margin-bottom: 3px; }
  .doc-title { font-size: 14px; font-weight: 800; letter-spacing: 0.2px; }
  .doc-sub { font-size: 8px; color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }

  .page-break { page-break-before: always; }
  .shop-header { border: 1px solid #777; border-radius: 2px; padding: 2px 6px; margin-bottom: 3px; }
  .shop-title-row { display: flex; justify-content: space-between; align-items: center; }
  .shop-name { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
  .bc-flag { font-size: 7px; font-weight: 800; border: 1px solid #777; border-radius: 2px;
    padding: 0 4px; letter-spacing: 0.5px; }
  .shop-meta { font-size: 8.5px; color: #555; }
  .shop-meta b { font-size: 9.5px; }
  .dot { margin: 0 3px; }

  .aisle { margin-bottom: 1px; }
  .aisle-label { background: #595959; color: #fff; font-size: 8.5px; font-weight: 800;
    letter-spacing: 0.8px; padding: 1px 5px; margin: 2px 0 1px; }
  .cat-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
    color: #555; border-bottom: 0.5px solid #999; margin: 1px 1px 1px; }

  /* STRICT: always two blocks per row. Fixed 50% width, never grows. */
  .grid { display: flex; flex-wrap: wrap; }
  .product { width: 50%; flex: 0 0 50%; max-width: 50%; border: 0.5px solid #999;
    padding: 1px 3px 2px; margin: 0 0 -0.5px; page-break-inside: avoid; break-inside: avoid;
    overflow: hidden; }

  .p-top { display: flex; align-items: baseline; gap: 3px; }
  .checkbox { flex: 0 0 auto; width: 10px; height: 10px; border: 1.2px solid #777;
    align-self: center; }
  .p-name { flex: 1 1 auto; font-size: 9.5px; font-weight: 700; word-break: break-word;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .size { display: inline-block; font-size: 8px; font-weight: 800; border: 0.5px solid #999;
    padding: 0 2px; white-space: nowrap; }
  .qty { flex: 0 0 auto; font-size: 13px; font-weight: 900; line-height: 1; }
  .price-now { flex: 0 0 auto; font-size: 9.5px; font-weight: 800; }

  .p-meta { display: flex; align-items: center; gap: 4px; margin-top: 1px; }
  .code-num { font-size: 8.5px; font-weight: 700; font-family: 'Courier New', monospace;
    letter-spacing: 0.2px; white-space: nowrap; }
  .code-num.case { color: #555; }
  .price-fix { display: flex; align-items: center; margin-left: auto;
    font-size: 8px; font-weight: 700; color: #555; }
  .price-box { display: inline-block; width: 36px; height: 11px; border: 0.5px solid #999;
    margin-left: 1px; background: #fff; }

  .bc-row { display: flex; gap: 4px; margin-top: 1px; }
  .bc { flex: 1 1 0; min-width: 0; }

  .doc-footer { margin-top: 3px; padding-top: 2px; border-top: 0.5px solid #999;
    font-size: 7px; color: #555; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-title">${esc(list.name || 'Shopping List')}</div>
    <div class="doc-sub">Picking sheet · ${products.length} items · ${esc(exportDate)}</div>
  </div>
  ${pages || '<p style="padding:20px;text-align:center;">This list is empty.</p>'}
  <div class="doc-footer">
    <span>Generated by Paymi</span>
    <span>Tick items as collected · write corrected prices in the boxes</span>
  </div>
</body>
</html>`;
}
