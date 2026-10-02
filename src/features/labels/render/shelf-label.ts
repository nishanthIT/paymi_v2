/**
 * Shelf-edge label renderer (70 × 38 mm) for Standard, Tobacco, Full yellow and
 * Half yellow. Deterministic and pure: thumbnails, the A4 preview and later the
 * PDF/printer paths all draw this same composition.
 */
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import type { Symbology } from '../model/barcode';
import { encodeBarcode } from './barcode-encode';

export type ShelfDesign = 'standard' | 'tobacco' | 'full_yellow' | 'half_yellow';

export interface ShelfLabelContent {
  brand?: string;
  name: string;
  packSize?: string;
  barcode?: string;
  symbology?: Symbology;
  /** Final price in pence; undefined = not entered (never drawn as £0.00). */
  priceMinor?: number;
  wasMinor?: number;
  offer?: { quantity: number; totalMinor: number };
}

export interface ShelfLabelOptions {
  penceSameSize: boolean;
  /** Pre-formatted job date, or undefined when Print the date is off. */
  dateText?: string;
  priceOnRight: boolean;
  barcodeDownSide: boolean;
  /** 0.6–1: usable content width inside the physical cell. */
  widthRatio: number;
  /** Pre-coloured stock: yellow areas are simulated in preview, never inked. */
  colouredStock: boolean;
}

export const INK = '#111111';
export const PROMO_YELLOW = '#F6DA3B';
export const WARN_RED = '#D93025';

const W = 70;
const H = 38;
const PAD = 2.5;
// Average bold sans glyph advance as a fraction of the font size (conservative).
const CHAR_W = 0.6;
const MIN_MODULE_MM = 0.25;

export const textWidthMm = (text: string, fontMm: number) => text.length * fontMm * CHAR_W;

/** Greedy word wrap; null if a single word is too wide or maxLines is exceeded. */
export function wrap(text: string, fontMm: number, widthMm: number, maxLines: number): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (textWidthMm(word, fontMm) > widthMm) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (textWidthMm(candidate, fontMm) <= widthMm) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

export function fitText(text: string, widthMm: number, maxLines: number, maxFont: number, minFont: number) {
  for (let f = maxFont; f >= minFont - 1e-6; f -= 0.1) {
    const lines = wrap(text, f, widthMm, maxLines);
    if (lines) return { lines, fontMm: f, fits: true };
  }
  // Never silently ellipsise product identity: report it so output is blocked.
  const fallback = wrap(text, minFont, widthMm, 99) ?? [text];
  return { lines: fallback.slice(0, maxLines), fontMm: minFont, fits: false };
}

export function formatPounds(minor: number, wholeIfRound = false): string {
  if (wholeIfRound && minor % 100 === 0) return `£${minor / 100}`;
  return `£${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export function priceParts(minor: number, flat: boolean) {
  const pounds = Math.floor(minor / 100);
  const pence = String(minor % 100).padStart(2, '0');
  return flat ? { major: `£${pounds}.${pence}`, minor: '' } : { major: `£${pounds}.`, minor: pence };
}

const MINOR_SCALE = 0.55;

function priceWidthFactor(parts: { major: string; minor: string }) {
  return (parts.major.length + parts.minor.length * MINOR_SCALE) * CHAR_W;
}

function priceNode(
  minor: number,
  flat: boolean,
  box: { x: number; y: number; w: number; h: number },
  maxFont: number,
  align: 'left' | 'center' | 'right',
): CompositionNode {
  const parts = priceParts(minor, flat);
  const fontMm = Math.min(maxFont, box.h / 1.05, box.w / priceWidthFactor(parts));
  const hMm = fontMm * 1.05;
  return {
    kind: 'price',
    xMm: box.x,
    yMm: box.y + box.h - hMm,
    wMm: box.w,
    hMm,
    major: parts.major,
    minor: parts.minor,
    flat,
    fontMm,
    minorScale: MINOR_SCALE,
    align,
    colour: INK,
  };
}

function textNode(
  lines: string[],
  x: number,
  y: number,
  w: number,
  fontMm: number,
  extra: Partial<Extract<CompositionNode, { kind: 'text' }>> = {},
): Extract<CompositionNode, { kind: 'text' }> {
  return { kind: 'text', xMm: x, yMm: y, wMm: w, lines, fontMm, lineHeightMm: fontMm * 1.18, weight: '700', colour: INK, ...extra };
}

interface BarcodeBlock {
  nodes: CompositionNode[];
  warning?: string;
}

/** Horizontal barcode with human-readable digits below, sized in whole-module steps. */
function barcodeBlock(
  content: ShelfLabelContent,
  box: { x: number; y: number; w: number; h: number },
  highlight: boolean,
): BarcodeBlock {
  if (!content.barcode || !content.symbology) return { nodes: [] };
  const encoded = encodeBarcode(content.barcode, content.symbology);
  if (!encoded) return { nodes: [], warning: 'Barcode could not be encoded' };
  const count = encoded.modules.length;
  const moduleMm = box.w / count;
  const digitsFont = Math.min(1.9, box.h * 0.18);
  const barsH = box.h - digitsFont * 1.15;
  const nodes: CompositionNode[] = [];
  if (highlight) {
    nodes.push({ kind: 'rect', xMm: box.x - 0.6, yMm: box.y - 0.6, wMm: box.w + 1.2, hMm: box.h + 1.2, fill: PROMO_YELLOW });
  }
  nodes.push({
    kind: 'barcode',
    xMm: box.x,
    yMm: box.y,
    wMm: box.w,
    hMm: barsH,
    value: content.barcode,
    symbology: content.symbology,
    modules: encoded.modules,
  });
  nodes.push(textNode([content.barcode], box.x, box.y + barsH + 0.15, box.w, digitsFont, { weight: '400', align: 'center' }));
  return {
    nodes,
    warning: moduleMm < MIN_MODULE_MM - 1e-6 ? 'Barcode is too small to scan at this width — widen the label area' : undefined,
  };
}

function needsPriceNode(box: { x: number; y: number; w: number; h: number }): CompositionNode {
  // Preview-only marker: a missing price is flagged, never printed as £0.00.
  return textNode(['Needs price'], box.x, box.y + box.h / 2 - 1.6, box.w, 2.6, {
    colour: WARN_RED,
    align: 'center',
    previewOnly: true,
  });
}

function displayTitle(content: ShelfLabelContent) {
  return [content.brand, content.name, content.packSize].filter((part) => part && part.trim()).join(' ');
}

function renderStandard(
  content: ShelfLabelContent,
  options: ShelfLabelOptions,
  tobacco: boolean,
): LabelComposition {
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  const dateH = options.dateText ? 2.6 : 0;
  const contentW = (W - PAD * 2) * options.widthRatio;
  const x0 = (W - contentW) / 2;
  const top = PAD;
  const bottom = H - PAD - dateH;
  const flat = options.penceSameSize;
  const title = displayTitle(content);
  const priceMax = tobacco ? 7.5 : 15;

  // Upright barcode column is a Standard-design feature only (spec §5).
  if (options.barcodeDownSide && !tobacco && content.barcode && content.symbology) {
    const encoded = encodeBarcode(content.barcode, content.symbology);
    // Wide enough that upright bars are longer than the flat layout's (~11 mm).
    const colW = 16;
    const colX = options.priceOnRight ? x0 : x0 + contentW - colW;
    const length = bottom - top;
    if (encoded) {
      const moduleMm = length / encoded.modules.length;
      const digitsFont = 1.8;
      const barsW = colW - digitsFont * 1.3;
      nodes.push({
        kind: 'barcode',
        xMm: colX,
        yMm: top,
        wMm: barsW,
        hMm: length,
        value: content.barcode,
        symbology: content.symbology,
        modules: encoded.modules,
        rotated: true,
      });
      nodes.push(textNode([content.barcode], colX + barsW + 0.2 - length / 2 + digitsFont / 2, top + length / 2 - digitsFont / 2, length, digitsFont, {
        weight: '400',
        align: 'center',
        rotateDeg: 90,
      }));
      if (moduleMm < MIN_MODULE_MM) warnings.push('Barcode is too small to scan at this height');
    } else {
      warnings.push('Barcode could not be encoded');
    }
    const textX = options.priceOnRight ? colX + colW + 1.5 : x0;
    const textW = contentW - colW - 1.5;
    const name = fitText(title, textW, 3, 3.6, 2.3);
    if (!name.fits) warnings.push('Name is too long for this label — shorten it');
    nodes.push(textNode(name.lines, textX, top, textW, name.fontMm, { align: 'left' }));
    const nameBottom = top + name.lines.length * name.fontMm * 1.18 + 0.8;
    const priceBox = { x: textX, y: nameBottom, w: textW, h: bottom - nameBottom };
    nodes.push(
      content.priceMinor != null
        ? priceNode(content.priceMinor, flat, priceBox, priceMax, options.priceOnRight ? 'right' : 'left')
        : needsPriceNode(priceBox),
    );
  } else {
    const name = fitText(title, contentW, 2, 3.4, 2.3);
    if (!name.fits) warnings.push('Name is too long for this label — shorten it');
    nodes.push(textNode(name.lines, x0, top, contentW, name.fontMm, { align: 'center' }));
    const rowTop = top + name.lines.length * name.fontMm * 1.18 + 1;
    const rowH = bottom - rowTop;
    const gap = 2;
    const encoded =
      content.barcode && content.symbology ? encodeBarcode(content.barcode, content.symbology) : null;
    // Take width from the price rather than shrinking bars below a scannable module.
    const barcodeW = encoded
      ? Math.min(contentW * 0.62, Math.max(contentW * 0.48, encoded.modules.length * MIN_MODULE_MM))
      : 0;
    const barcodeX = options.priceOnRight ? x0 : x0 + contentW - barcodeW;
    const priceX = options.priceOnRight ? x0 + barcodeW + gap : x0;
    const hasBarcode = !!(content.barcode && content.symbology);
    const priceW = hasBarcode ? contentW - barcodeW - gap : contentW;
    const barcodeH = Math.min(rowH, 13);
    const block = barcodeBlock(content, { x: barcodeX, y: bottom - barcodeH, w: barcodeW, h: barcodeH }, tobacco);
    nodes.push(...block.nodes);
    if (block.warning) warnings.push(block.warning);
    const priceBox = { x: hasBarcode ? priceX : x0, y: rowTop, w: priceW, h: rowH };
    nodes.push(
      content.priceMinor != null
        ? priceNode(content.priceMinor, flat, priceBox, priceMax, hasBarcode ? (options.priceOnRight ? 'right' : 'left') : 'center')
        : needsPriceNode(priceBox),
    );
  }

  if (options.dateText) {
    nodes.push(textNode([options.dateText], x0, H - PAD - 2.2, contentW, 1.8, { weight: '400', align: 'center' }));
  }
  return { widthMm: W, heightMm: H, nodes, warnings };
}

function renderPromo(content: ShelfLabelContent, options: ShelfLabelOptions, full: boolean): LabelComposition {
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  const contentW = (W - PAD * 2) * options.widthRatio;
  const x0 = (W - contentW) / 2;
  const leftW = contentW * 0.54;
  const splitX = x0 + leftW + PAD / 2;
  const previewOnly = options.colouredStock;

  if (full) {
    nodes.push({ kind: 'rect', xMm: 0, yMm: 0, wMm: W, hMm: H, fill: PROMO_YELLOW, previewOnly });
  } else {
    nodes.push({ kind: 'rect', xMm: splitX, yMm: 0, wMm: W - splitX, hMm: H, fill: PROMO_YELLOW, previewOnly });
  }

  // Left panel: brand / name / pack, prices, barcode.
  const dateH = options.dateText ? 2.4 : 0;
  let y = PAD;
  const small = 2.5;
  const lineGap = small * 1.18;
  if (content.brand?.trim()) {
    const brand = fitText(content.brand.trim(), leftW, 1, small, 1.9);
    nodes.push(textNode(brand.lines, x0, y, leftW, brand.fontMm));
    y += lineGap;
  }
  const name = fitText(content.name.trim(), leftW, content.brand?.trim() ? 1 : 2, small, 1.9);
  if (!name.fits) warnings.push('Name is too long for this label — shorten it');
  nodes.push(textNode(name.lines, x0, y, leftW, name.fontMm));
  y += name.lines.length * name.fontMm * 1.18;
  if (content.packSize?.trim()) {
    nodes.push(textNode([content.packSize.trim()], x0, y, leftW, 2.1, { weight: '600' }));
    y += 2.1 * 1.18;
  }
  y += 1;

  if (content.wasMinor != null) {
    const was = formatPounds(content.wasMinor);
    nodes.push(textNode([was], x0, y, textWidthMm(was, 2.4) + 0.4, 2.4, { strike: true, weight: '800' }));
  }
  if (content.offer && content.priceMinor != null) {
    const each = `Each ${formatPounds(content.priceMinor)}`;
    const eachX = content.wasMinor != null ? x0 + textWidthMm(formatPounds(content.wasMinor), 2.4) + 1.4 : x0;
    nodes.push(textNode([each], eachX, y, x0 + leftW - eachX, 2.4, { weight: '800' }));
  }
  const pricesBottom = y + 2.4 * 1.18 + 0.8;
  const barcodeH = Math.min(9, H - PAD - dateH - pricesBottom);
  if (barcodeH > 4) {
    const block = barcodeBlock(content, { x: x0, y: H - PAD - dateH - barcodeH, w: leftW, h: barcodeH }, false);
    nodes.push(...block.nodes);
    if (block.warning) warnings.push(block.warning);
  }
  if (options.dateText) {
    nodes.push(textNode([options.dateText], x0, H - PAD - 2, leftW, 1.7, { weight: '400' }));
  }

  // Right panel: two-line multi-buy headline, or the single price when no offer.
  const rightX = splitX + 1.2;
  const rightW = x0 + contentW - rightX;
  if (content.offer) {
    const top = `${content.offer.quantity} FOR`;
    const bottomText = formatPounds(content.offer.totalMinor, true);
    const font = Math.min(7.2, rightW / (Math.max(top.length, bottomText.length) * CHAR_W));
    const blockH = font * 1.08 * 2;
    const blockY = (H - blockH) / 2;
    nodes.push(textNode([top, bottomText], rightX, blockY, rightW, font, { weight: '800', align: 'center', lineHeightMm: font * 1.08 }));
  } else if (content.priceMinor != null) {
    nodes.push(priceNode(content.priceMinor, options.penceSameSize, { x: rightX, y: PAD, w: rightW, h: H / 2 + 6 }, 11, 'center'));
  } else {
    nodes.push(needsPriceNode({ x: rightX, y: PAD, w: rightW, h: H - PAD * 2 }));
  }

  return { widthMm: W, heightMm: H, nodes, warnings };
}

export function renderShelfLabel(
  design: ShelfDesign,
  content: ShelfLabelContent,
  options: ShelfLabelOptions,
): LabelComposition {
  switch (design) {
    case 'standard':
      return renderStandard(content, options, false);
    case 'tobacco':
      return renderStandard(content, { ...options, barcodeDownSide: false }, true);
    case 'full_yellow':
      return renderPromo(content, options, true);
    case 'half_yellow':
      return renderPromo(content, options, false);
  }
}

/** Design-preview fixtures (reference thumbnails). Never enter a production job. */
export const FIXTURE_STANDARD: ShelfLabelContent = {
  name: 'Mud House Sauvignon Blanc',
  packSize: '75cl',
  // GS1 restricted-circulation prefix 2 — cannot collide with a real product.
  barcode: '2000000000008',
  symbology: 'EAN13',
  priceMinor: 875,
};

export const FIXTURE_PROMO: ShelfLabelContent = {
  brand: 'Mud House',
  name: 'Sauvignon Blanc',
  packSize: '75cl',
  barcode: '2000000000008',
  symbology: 'EAN13',
  priceMinor: 875,
  wasMinor: 1125,
  offer: { quantity: 2, totalMinor: 1600 },
};
