// Dev-only visual check: serialise renderer compositions to SVG (same nodes the
// app draws) and write an HTML board for a headless-Chromium screenshot.
// Usage: node --import ./scripts/register-ts-hook.mjs scripts/labels-render-board.mjs /tmp/board.html
import { writeFileSync } from 'node:fs';

import { STANDARD_SHELF_SHEET as SHEET } from '../src/features/labels/registry/sizes.ts';
import { cellRect, expandInstances, paginate } from '../src/features/labels/render/sheet-layout.ts';
import { FIXTURE_PROMO, FIXTURE_STANDARD, renderShelfLabel } from '../src/features/labels/render/shelf-label.ts';

const out = process.argv[2] ?? '/tmp/labels-board.html';
const BASE = { penceSameSize: false, priceOnRight: true, barcodeDownSide: false, widthRatio: 1, colouredStock: false };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function nodeSvg(n) {
  if (n.kind === 'rect') return `<rect x="${n.xMm}" y="${n.yMm}" width="${n.wMm}" height="${n.hMm}" fill="${n.fill ?? 'none'}"/>`;
  if (n.kind === 'text') {
    const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : 'start';
    const x = n.align === 'center' ? n.xMm + n.wMm / 2 : n.align === 'right' ? n.xMm + n.wMm : n.xMm;
    const rot = n.rotateDeg ? ` transform="rotate(${n.rotateDeg} ${n.xMm + n.wMm / 2} ${n.yMm + n.lineHeightMm / 2})"` : '';
    return n.lines
      .map((line, i) => `<text x="${x}" y="${n.yMm + i * n.lineHeightMm + n.fontMm * 0.9}" font-size="${n.fontMm}" font-weight="${n.weight ?? 700}" text-anchor="${anchor}" fill="${n.colour ?? '#111'}"${n.strike ? ' text-decoration="line-through"' : ''}${rot}>${esc(line)}</text>`)
      .join('');
  }
  if (n.kind === 'price') {
    const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : 'start';
    const x = n.align === 'center' ? n.xMm + n.wMm / 2 : n.align === 'right' ? n.xMm + n.wMm : n.xMm;
    const base = n.yMm + n.fontMm * 0.95;
    return `<text x="${x}" y="${base}" font-size="${n.fontMm}" font-weight="800" text-anchor="${anchor}" fill="${n.colour}">${esc(n.major)}${n.minor ? `<tspan font-size="${n.fontMm * n.minorScale}" dy="${-n.fontMm * 0.33}">${n.minor}</tspan>` : ''}</text>`;
  }
  if (n.kind === 'barcode') {
    const count = n.modules.length;
    let bars = '';
    for (let i = 0; i < count; i++) {
      if (n.modules[i] !== '1') continue;
      bars += n.rotated
        ? `<rect x="${n.xMm}" y="${n.yMm + (i * n.hMm) / count}" width="${n.wMm}" height="${n.hMm / count + 0.001}"/>`
        : `<rect x="${n.xMm + (i * n.wMm) / count}" y="${n.yMm}" width="${n.wMm / count + 0.001}" height="${n.hMm}"/>`;
    }
    return `<g fill="#000" shape-rendering="crispEdges">${bars}</g>`;
  }
  return '';
}

const labelSvg = (c, pxPerMm, withPreviewOnly = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${c.widthMm * pxPerMm}" height="${c.heightMm * pxPerMm}" viewBox="0 0 ${c.widthMm} ${c.heightMm}" style="font-family:Inter,Helvetica,Arial,sans-serif;background:#fff;outline:1px solid #c9cbd1">${c.nodes.filter((n) => withPreviewOnly || !n.previewOnly).map(nodeSvg).join('')}</svg>`;

function sheetSvg(pages, compFor, pxPerMm) {
  return pages
    .map((page) => {
      let cells = '';
      page.forEach((inst, i) => {
        const r = cellRect(SHEET, i + 1);
        cells += `<rect x="${r.xMm}" y="${r.yMm}" width="${r.wMm}" height="${r.hMm}" fill="none" stroke="#e3e4e8" stroke-width="0.3"/>`;
        if (inst) cells += `<g transform="translate(${r.xMm} ${r.yMm})">${compFor(inst.itemId).nodes.map(nodeSvg).join('')}</g>`;
      });
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${210 * pxPerMm}" height="${297 * pxPerMm}" viewBox="0 0 210 297" style="font-family:Inter,Helvetica,Arial,sans-serif;background:#fff;border:1px solid #c4c5ca;margin:8px">${cells}</svg>`;
    })
    .join('');
}

const designs = [
  ['Standard', renderShelfLabel('standard', FIXTURE_STANDARD, BASE)],
  ['Tobacco', renderShelfLabel('tobacco', FIXTURE_STANDARD, BASE)],
  ['Full yellow', renderShelfLabel('full_yellow', FIXTURE_PROMO, BASE)],
  ['Half yellow', renderShelfLabel('half_yellow', FIXTURE_PROMO, BASE)],
  ['Standard · pence same size', renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, penceSameSize: true })],
  ['Standard · price on left', renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, priceOnRight: false })],
  ['Standard · barcode down the side', renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, barcodeDownSide: true })],
  ['Standard · date · 78% width', renderShelfLabel('standard', FIXTURE_STANDARD, { ...BASE, dateText: '25/09/2026', widthRatio: 0.78 })],
];

// Two copies from Start at 21 → one label on sheet 1 cell 21, one on sheet 2 cell 1.
const twoCopy = paginate(expandInstances([{ id: 'p', copies: 2 }]), 21, SHEET);
const promoComp = renderShelfLabel('half_yellow', FIXTURE_PROMO, BASE);

writeFileSync(
  out,
  `<!doctype html><html><body style="margin:16px;background:#f5f5f5;font:14px sans-serif">
  <div style="display:flex;flex-wrap:wrap;gap:16px">${designs
    .map(([name, c]) => `<figure style="margin:0"><figcaption>${name}${c.warnings.length ? ` ⚠ ${c.warnings.join('; ')}` : ''}</figcaption>${labelSvg(c, 6)}</figure>`)
    .join('')}</div>
  <h3>Start at 21 · 2 copies · Half yellow</h3>
  <div style="display:flex">${sheetSvg(twoCopy, () => promoComp, 1.6)}</div>
  </body></html>`,
);
console.log('wrote', out);
