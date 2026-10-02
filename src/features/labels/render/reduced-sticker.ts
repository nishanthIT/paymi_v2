/**
 * Reduced-sticker renderer for any physical size (roll labels, landscape or
 * portrait). Designs: Reduced, Was / Now, and a provisional "Price" design
 * (the third reference card is cropped — its full layout is inferred).
 */
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import type { Symbology } from '../model/barcode';
import { encodeBarcode } from './barcode-encode';
import { fitText, formatPounds, INK, PROMO_YELLOW, textWidthMm } from './shelf-label';

export type StickerDesign = 'reduced' | 'was_now' | 'price';
export type StickerBackground = 'none' | 'white' | 'yellow' | 'red';
export type StickerTextColour = 'black' | 'red';

export const STICKER_RED = '#E53935';

export interface StickerContent {
  title: string;
  productName?: string;
  barcode?: string;
  symbology?: Symbology;
  /** Undefined = not entered. The empty preview shows £0.00 as a preview-only placeholder. */
  priceMinor?: number;
  wasMinor?: number;
}

export interface StickerOptions {
  widthMm: number;
  heightMm: number;
  background: StickerBackground;
  textColour: StickerTextColour;
  dateText?: string;
}

const MIN_MODULE_MM = 0.25;
const BG_FILL: Record<Exclude<StickerBackground, 'none'>, string> = {
  white: '#FFFFFF',
  yellow: PROMO_YELLOW,
  red: STICKER_RED,
};

type TextNode = Extract<CompositionNode, { kind: 'text' }>;

function text(
  lines: string[],
  x: number,
  y: number,
  w: number,
  fontMm: number,
  colour: string,
  extra: Partial<TextNode> = {},
): TextNode {
  return { kind: 'text', xMm: x, yMm: y, wMm: w, lines, fontMm, lineHeightMm: fontMm * 1.12, weight: '800', align: 'center', colour, ...extra };
}

/** Largest single-line font that fits both width and height. */
function fitLine(value: string, w: number, h: number, maxFont = 99) {
  // Heavy (800) capitals and digits run ~0.7 em wide; stay conservative so text never clips.
  return Math.max(0.8, Math.min(maxFont, h / 1.12, w / Math.max(1, value.length * 0.72)));
}

function barcodeNodes(
  content: StickerContent,
  box: { x: number; y: number; w: number; h: number },
  needsBacking: boolean,
  warnings: string[],
  labelW: number,
): CompositionNode[] {
  if (!content.barcode || !content.symbology) return [];
  const encoded = encodeBarcode(content.barcode, content.symbology);
  if (!encoded) {
    warnings.push('Barcode could not be encoded');
    return [];
  }
  const count = encoded.modules.length;
  // Keep ≥ MIN_MODULE_MM. Quiet zones are blank, so they may spill into the side padding (not past a 0.5 mm edge).
  const need = count * MIN_MODULE_MM;
  const width = box.w >= need ? box.w : Math.min(need, labelW - 1);
  if (width / count < MIN_MODULE_MM - 1e-6) warnings.push('Barcode is too small to scan on this label size');
  const x = box.x + (box.w - width) / 2;
  const digitsFont = Math.min(2, box.h * 0.22);
  const barsH = box.h - digitsFont * 1.1;
  const nodes: CompositionNode[] = [];
  // Bars stay black on white regardless of background or text colour.
  if (needsBacking) {
    const bx = Math.max(0, x - 0.6);
    nodes.push({ kind: 'rect', xMm: bx, yMm: box.y - 0.4, wMm: Math.min(labelW, x + width + 0.6) - bx, hMm: box.h + 0.8, fill: '#FFFFFF' });
  }
  nodes.push({ kind: 'barcode', xMm: x, yMm: box.y, wMm: width, hMm: barsH, value: content.barcode, symbology: content.symbology, modules: encoded.modules });
  nodes.push(text([content.barcode], x, box.y + barsH + 0.1, width, digitsFont, INK, { weight: '400' }));
  return nodes;
}

function priceBlock(
  content: StickerContent,
  box: { x: number; y: number; w: number; h: number },
  colour: string,
  align: 'center' | 'right',
): CompositionNode {
  if (content.priceMinor != null) {
    const value = formatPounds(content.priceMinor);
    return text([value], box.x, box.y, box.w, fitLine(value, box.w, box.h), colour, { align });
  }
  // Empty-state placeholder exactly as the reference; never inked (Print is blocked).
  const placeholder = '£0.00';
  return text([placeholder], box.x, box.y, box.w, fitLine(placeholder, box.w, box.h), colour, { align, previewOnly: true });
}

function renderReduced(c: StickerContent, o: StickerOptions, pad: number, colour: string, backing: boolean): { nodes: CompositionNode[]; warnings: string[] } {
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  const w = o.widthMm - pad * 2;
  const dateH = o.dateText ? Math.min(2.4, o.heightMm * 0.08) : 0;
  const innerH = o.heightMm - pad * 2 - dateH;
  const hasBarcode = !!(c.barcode && c.symbology);
  const hasWas = c.wasMinor != null && c.priceMinor != null;
  const title = c.title.trim();

  // Present blocks share the height; missing optional ones collapse their space.
  const weights = [title ? 1 : 0, hasBarcode ? 1.05 : 0, 1.25];
  const total = weights.reduce((a, b) => a + b, 0);
  let y = pad;
  const [titleH, barcodeH, priceH] = weights.map((weight) => (innerH * weight) / total);

  if (title) {
    const font = fitLine(title, w, titleH * 0.92);
    nodes.push(text([title], pad, y + (titleH - font * 1.12) / 2, w, font, colour));
    y += titleH;
  }
  if (hasBarcode) {
    nodes.push(...barcodeNodes(c, { x: pad, y: y + barcodeH * 0.06, w, h: barcodeH * 0.9 }, backing, warnings, o.widthMm));
    y += barcodeH;
  }
  if (hasWas && w < innerH) {
    // Narrow/portrait: stack "Was" above a centred NOW + price.
    const was = `Was ${formatPounds(c.wasMinor!)}`;
    const wasFont = fitLine(was, w, priceH * 0.2, 3);
    nodes.push(text([was], pad, y, w, wasFont, colour, { strike: true, weight: '700' }));
    const capFont = Math.min(2.2, priceH * 0.12);
    nodes.push(text(['NOW'], pad, y + wasFont * 1.3, w, capFont, colour));
    const now = formatPounds(c.priceMinor!);
    const top = y + wasFont * 1.3 + capFont * 1.2;
    nodes.push(text([now], pad, top, w, fitLine(now, w, y + priceH - top), colour));
  } else if (hasWas) {
    const was = `Was ${formatPounds(c.wasMinor!)}`;
    const wasFont = Math.min(priceH * 0.26, (w * 0.34) / (was.length * 0.6));
    const now = formatPounds(c.priceMinor!);
    const nowFont = fitLine(now, w * 0.5, priceH * 0.95);
    const capFont = nowFont * 0.34;
    const nowW = textWidthMm(now, nowFont) * 1.02;
    const baseY = y + priceH - nowFont * 1.12;
    nodes.push(text([was], pad, baseY + nowFont * 1.12 - wasFont * 1.5, w * 0.36, wasFont, colour, { align: 'left', strike: true, weight: '700' }));
    nodes.push(text(['NOW'], pad + w - nowW - capFont * 2.4, baseY + nowFont * 1.12 - capFont * 1.6, capFont * 2.3, capFont, colour, { align: 'right' }));
    nodes.push(text([now], pad + w - nowW, baseY, nowW, nowFont, colour, { align: 'right' }));
  } else {
    nodes.push(priceBlock(c, { x: pad, y, w, h: priceH }, colour, 'center'));
  }
  return { nodes, warnings };
}

function renderWasNow(c: StickerContent, o: StickerOptions, pad: number, colour: string, backing: boolean): { nodes: CompositionNode[]; warnings: string[] } {
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  const w = o.widthMm - pad * 2;
  const dateH = o.dateText ? Math.min(2.4, o.heightMm * 0.08) : 0;
  const innerH = o.heightMm - pad * 2 - dateH;
  const hasBarcode = !!(c.barcode && c.symbology);
  const name = (c.productName ?? '').trim();
  const nameH = name ? innerH * 0.2 : 0;
  const barcodeH = hasBarcode ? innerH * 0.32 : 0;
  const priceH = innerH - nameH - barcodeH;
  let y = pad;

  if (name) {
    const fitted = fitText(name.toUpperCase(), w, 1, nameH * 0.8, Math.min(1.6, nameH * 0.8));
    if (!fitted.fits) warnings.push('Product name is too long for this sticker — shorten it');
    nodes.push(text(fitted.lines, pad, y + (nameH - fitted.fontMm * 1.12) / 2, w, fitted.fontMm, colour));
    y += nameH;
  }

  const hasWas = c.wasMinor != null;
  const nowX = hasWas ? pad + w * 0.38 : pad;
  const nowW = hasWas ? w * 0.62 : w;
  const cap = Math.min(1.6, priceH * 0.14);
  if (hasWas) {
    const was = formatPounds(c.wasMinor!);
    const wasFont = Math.min(priceH * 0.3, (w * 0.34) / (was.length * 0.6));
    nodes.push(text(['WAS'], pad, y + priceH * 0.2, w * 0.36, cap, colour, { align: 'left', weight: '700' }));
    nodes.push(text([was], pad, y + priceH * 0.2 + cap * 1.3, w * 0.36, wasFont, colour, { align: 'left', strike: true, weight: '700' }));
    nodes.push(text(['NOW'], nowX, y, nowW, cap, colour, { weight: '700' }));
  }
  const priceTop = y + (hasWas ? cap * 1.3 : 0);
  nodes.push(priceBlock(c, { x: nowX, y: priceTop, w: nowW, h: y + priceH - priceTop }, colour, 'center'));
  y += priceH;

  if (hasBarcode) nodes.push(...barcodeNodes(c, { x: pad, y: y + barcodeH * 0.08, w, h: barcodeH * 0.9 }, backing, warnings, o.widthMm));
  return { nodes, warnings };
}

/** Provisional "Price" design: name, one large price, barcode (full reference unseen). */
function renderPrice(c: StickerContent, o: StickerOptions, pad: number, colour: string, backing: boolean): { nodes: CompositionNode[]; warnings: string[] } {
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  const w = o.widthMm - pad * 2;
  const dateH = o.dateText ? Math.min(2.4, o.heightMm * 0.08) : 0;
  const innerH = o.heightMm - pad * 2 - dateH;
  const hasBarcode = !!(c.barcode && c.symbology);
  const name = (c.productName ?? '').trim();
  const nameH = name ? innerH * 0.18 : 0;
  const barcodeH = hasBarcode ? innerH * 0.32 : 0;
  const priceH = innerH - nameH - barcodeH;
  let y = pad;
  if (name) {
    const fitted = fitText(name.toUpperCase(), w, 1, nameH * 0.8, Math.min(1.6, nameH * 0.8));
    if (!fitted.fits) warnings.push('Product name is too long for this sticker — shorten it');
    nodes.push(text(fitted.lines, pad, y + (nameH - fitted.fontMm * 1.12) / 2, w, fitted.fontMm, colour));
    y += nameH;
  }
  nodes.push(priceBlock(c, { x: pad, y, w, h: priceH }, colour, 'center'));
  y += priceH;
  if (hasBarcode) nodes.push(...barcodeNodes(c, { x: pad, y: y + barcodeH * 0.08, w, h: barcodeH * 0.9 }, backing, warnings, o.widthMm));
  return { nodes, warnings };
}

export function renderSticker(design: StickerDesign, content: StickerContent, options: StickerOptions): LabelComposition {
  const pad = Math.max(1.2, Math.min(options.widthMm, options.heightMm) * 0.06);
  const colour = options.textColour === 'red' ? STICKER_RED : INK;
  const nodes: CompositionNode[] = [];
  if (options.background !== 'none') {
    nodes.push({ kind: 'rect', xMm: 0, yMm: 0, wMm: options.widthMm, hMm: options.heightMm, fill: BG_FILL[options.background] });
  }
  const backing = options.background === 'yellow' || options.background === 'red';
  const body =
    design === 'reduced'
      ? renderReduced(content, options, pad, colour, backing)
      : design === 'was_now'
        ? renderWasNow(content, options, pad, colour, backing)
        : renderPrice(content, options, pad, colour, backing);
  nodes.push(...body.nodes);
  if (options.dateText) {
    const font = Math.min(1.9, options.heightMm * 0.065);
    nodes.push(text([options.dateText], pad, options.heightMm - pad - font * 1.1, options.widthMm - pad * 2, font, colour, { weight: '400' }));
  }
  return { widthMm: options.widthMm, heightMm: options.heightMm, nodes, warnings: body.warnings };
}

/** Design-carousel fixtures matching the reference thumbnails (preview-only). */
export const STICKER_FIXTURE: StickerContent = {
  title: 'REDUCED',
  productName: 'Product name',
  barcode: '5000168001357',
  symbology: 'EAN13',
  priceMinor: 799,
  wasMinor: 1369,
};
