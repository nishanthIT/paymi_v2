/**
 * Shelf-talker / alcohol-tag renderer for catalogue templates T01–T19.
 * One deterministic composition per template feeds the catalogue thumbnail,
 * the editor preview and (Batch 9) PDF output. Sizes come from the registry.
 */
import { TEMPLATES } from '../registry/manifest';
import { LABEL_SIZES } from '../registry/sizes';
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import { fitText, formatPounds, INK, WARN_RED } from './shelf-label';

export const TALKER_RED = '#F44236';
export const OFFER_YELLOW = '#FFD60A';
export const WOW_YELLOW = '#FFD84D';
const GREY = '#6E7176';
const FIXTURE_BACKDROP = '#FBEADF';

export interface TalkerContent {
  name: string;
  brand?: string;
  packSize?: string;
  /** Final price in pence; undefined = not entered (never drawn as £0.00). */
  priceMinor?: number;
  wasMinor?: number;
  offer?: { quantity: number; totalMinor: number };
  /** Badge / banner / circle text (WOW, OFFER…). Template default when empty. */
  headline?: string;
  /** Multi-buy "which products" line. */
  listText?: string;
  /** Owner-approved small print. Never invented. */
  footer?: string;
  imageUri?: string;
  /** Catalogue-only: draw the reference red-bottle illustration. */
  fixtureArt?: boolean;
  /** Which reference illustration: red bottle, blue container or green pack. */
  fixtureKind?: FixtureKind;
}

export type FixtureKind = 'bottle' | 'container' | 'pack';

type Box = { x: number; y: number; w: number; h: number };
type TextNode = Extract<CompositionNode, { kind: 'text' }>;

export function t(lines: string[], x: number, y: number, w: number, fontMm: number, extra: Partial<TextNode> = {}): TextNode {
  return { kind: 'text', xMm: x, yMm: y, wMm: w, lines, fontMm, lineHeightMm: fontMm * 1.15, weight: '800', align: 'left', colour: INK, ...extra };
}

/** Largest single-line font fitting the box (heavy weight glyphs ≈ 0.7 em). */
export function fit(value: string, w: number, h: number, max = 99) {
  return Math.max(0.8, Math.min(max, h / 1.15, w / Math.max(1, value.length * 0.7)));
}

export function disc(cx: number, cy: number, d: number, fill: string): CompositionNode {
  return { kind: 'rect', xMm: cx - d / 2, yMm: cy - d / 2, wMm: d, hMm: d, fill, radiusMm: d / 2 };
}

const ART_BACKDROP: Record<FixtureKind, string> = { bottle: FIXTURE_BACKDROP, container: '#E4EEFB', pack: '#E7F2E3' };

/** Reference sample art on its pale tile: red bottle, blue container or green pack. */
function fixtureBottle(box: Box, kind: FixtureKind = 'bottle'): CompositionNode[] {
  const backdrop: CompositionNode = { kind: 'rect', xMm: box.x, yMm: box.y, wMm: box.w, hMm: box.h, fill: ART_BACKDROP[kind], radiusMm: box.h * 0.04 };
  const cx = box.x + box.w / 2;
  const bottom = box.y + box.h * 0.9;
  if (kind === 'container') {
    const bw = Math.min(box.w * 0.42, box.h * 0.36);
    const bodyH = box.h * 0.62;
    return [
      backdrop,
      { kind: 'rect', xMm: cx - bw / 2, yMm: bottom - bodyH, wMm: bw, hMm: bodyH, fill: '#1E63D6', radiusMm: bw * 0.14 },
      { kind: 'rect', xMm: cx - bw * 0.36, yMm: bottom - bodyH - box.h * 0.08, wMm: bw * 0.72, hMm: box.h * 0.09, fill: '#123E8C', radiusMm: bw * 0.06 },
      { kind: 'rect', xMm: cx - bw / 2, yMm: bottom - bodyH * 0.6, wMm: bw, hMm: bodyH * 0.16, fill: '#FFFFFF' },
    ];
  }
  if (kind === 'pack') {
    const bw = Math.min(box.w * 0.5, box.h * 0.46);
    const bodyH = box.h * 0.74;
    return [
      backdrop,
      { kind: 'rect', xMm: cx - bw / 2, yMm: bottom - bodyH, wMm: bw, hMm: bodyH, fill: '#2E8B3A', radiusMm: bw * 0.05 },
      { kind: 'rect', xMm: cx - bw * 0.38, yMm: bottom - bodyH * 0.72, wMm: bw * 0.76, hMm: bodyH * 0.34, fill: '#F4E7A8' },
      { kind: 'rect', xMm: cx - bw * 0.3, yMm: bottom - bodyH * 0.2, wMm: bw * 0.6, hMm: bodyH * 0.07, fill: '#FFFFFF' },
    ];
  }
  const bw = Math.min(box.w * 0.34, box.h * 0.32);
  const bodyH = box.h * 0.5;
  return [
    backdrop,
    { kind: 'rect', xMm: cx - bw / 2, yMm: bottom - bodyH, wMm: bw, hMm: bodyH, fill: TALKER_RED, radiusMm: bw * 0.18 },
    { kind: 'rect', xMm: cx - bw * 0.2, yMm: bottom - bodyH - box.h * 0.2, wMm: bw * 0.4, hMm: box.h * 0.22, fill: TALKER_RED },
    { kind: 'rect', xMm: cx - bw * 0.24, yMm: bottom - bodyH - box.h * 0.27, wMm: bw * 0.48, hMm: box.h * 0.08, fill: '#B3261E' },
    { kind: 'rect', xMm: cx - bw / 2, yMm: bottom - bodyH * 0.62, wMm: bw, hMm: bodyH * 0.24, fill: '#FFFFFF' },
  ];
}

export function photo(c: TalkerContent, box: Box): CompositionNode[] {
  if (c.imageUri) return [{ kind: 'image', xMm: box.x, yMm: box.y, wMm: box.w, hMm: box.h, uri: c.imageUri }];
  return c.fixtureArt ? fixtureBottle(box, c.fixtureKind) : [];
}

export const hasPhoto = (c: TalkerContent) => !!c.imageUri || !!c.fixtureArt;

export function needsPrice(box: Box): TextNode {
  return t(['Needs price'], box.x, box.y + box.h / 2 - 2, box.w, Math.min(4, box.h * 0.3), {
    colour: WARN_RED,
    align: 'center',
    previewOnly: true,
  });
}

export function price(c: TalkerContent, box: Box, colour: string, align: 'left' | 'center' | 'right', max = 99): TextNode {
  if (c.priceMinor == null) return needsPrice(box);
  const value = formatPounds(c.priceMinor);
  const f = fit(value, box.w, box.h, max);
  return t([value], box.x, box.y + (box.h - f * 1.15) / 2, box.w, f, { colour, align });
}

/** Multi-buy headline: "2 FOR £16" when an offer is set, otherwise "OFFER £1.99". */
function offerHeadline(c: TalkerContent): string | null {
  if (c.offer) return `${c.offer.quantity} FOR ${formatPounds(c.offer.totalMinor, true)}`;
  if (c.priceMinor != null) return `${(c.headline || 'OFFER').toUpperCase()} ${formatPounds(c.priceMinor)}`;
  return null;
}

export function footer(c: TalkerContent, box: Box): CompositionNode[] {
  if (c.footer?.trim()) return [t([c.footer.trim()], box.x, box.y, box.w, box.h, { weight: '400', colour: GREY, align: 'center' })];
  // Catalogue thumbnails show an illegible small-print line; keep its space, invent no words.
  return c.fixtureArt ? [{ kind: 'rect', xMm: box.x + box.w * 0.3, yMm: box.y + box.h * 0.35, wMm: box.w * 0.4, hMm: box.h * 0.3, fill: '#D9DADE' }] : [];
}

function nameBlock(c: TalkerContent, box: Box, maxFont: number, warnings: string[], extra: Partial<TextNode> = {}) {
  const f = fitText(c.name.trim() || ' ', box.w, 2, maxFont, Math.max(1.4, maxFont * 0.45));
  if (!f.fits) warnings.push('Name is too long for this design — shorten it');
  return { node: t(f.lines, box.x, box.y, box.w, f.fontMm, { weight: '700', ...extra }), bottom: box.y + f.lines.length * f.fontMm * 1.15 };
}

function brandLine(c: TalkerContent, x: number, y: number, w: number, f: number, extra: Partial<TextNode> = {}) {
  const parts = [c.brand, c.packSize].filter((p) => p && p.trim()).join(' · ');
  return parts ? [t([parts], x, y, w, f, { weight: '400', colour: GREY, ...extra })] : [];
}

type Body = { nodes: CompositionNode[]; warnings: string[] };

// ---------- Wide shelf family: 203 × 75, 8 × 3 in ----------

function wowCircleShelf(c: TalkerContent, W: number, H: number, withBadge: boolean): Body {
  const warnings: string[] = [];
  const pad = H * 0.08;
  const d = H * 0.64;
  const cx = pad + d / 2;
  const cy = H * 0.47;
  const nodes: CompositionNode[] = [disc(cx, cy, d, TALKER_RED)];
  nodes.push(c.priceMinor != null ? price(c, { x: cx - d * 0.4, y: cy - d * 0.25, w: d * 0.8, h: d * 0.5 }, '#FFFFFF', 'center') : needsPrice({ x: cx - d / 2, y: cy - d / 4, w: d, h: d / 2 }));
  const photoW = hasPhoto(c) ? W * 0.14 : 0;
  const textX = pad + d + W * 0.02;
  const textW = W - textX - pad - photoW - (photoW ? W * 0.02 : 0);
  let y = H * 0.24;
  if (withBadge) {
    const label = (c.headline || 'WOW').toUpperCase();
    const bh = H * 0.07;
    nodes.push({ kind: 'rect', xMm: textX, yMm: y, wMm: Math.max(bh * 2.4, label.length * bh * 0.62), hMm: bh, fill: WOW_YELLOW, radiusMm: bh * 0.15 });
    nodes.push(t([label], textX, y + bh * 0.12, Math.max(bh * 2.4, label.length * bh * 0.62), bh * 0.7, { colour: TALKER_RED, align: 'center' }));
    y += bh * 1.3;
  }
  const name = nameBlock(c, { x: textX, y, w: textW, h: H * 0.3 }, H * 0.11, warnings);
  nodes.push(name.node, ...brandLine(c, textX, name.bottom + H * 0.02, textW, H * 0.06));
  if (photoW) nodes.push(...photo(c, { x: W - pad - photoW, y: H * 0.14, w: photoW, h: H * 0.72 }));
  nodes.push(...footer(c, { x: W * 0.25, y: H * 0.9, w: W * 0.5, h: H * 0.04 }));
  return { nodes, warnings };
}

function specialOffer(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const bannerH = H * 0.12;
  const pad = H * 0.08;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: 0, yMm: 0, wMm: W, hMm: bannerH, fill: TALKER_RED }];
  const banner = (c.headline || 'WOW').toUpperCase();
  nodes.push(t([banner], 0, bannerH * 0.18, W, bannerH * 0.62, { colour: '#FFFFFF', align: 'center' }));
  const photoW = hasPhoto(c) ? W * 0.14 : 0;
  const textW = W - pad * 2 - photoW - W * 0.02;
  const name = nameBlock(c, { x: pad, y: bannerH + H * 0.1, w: textW, h: H * 0.2 }, H * 0.1, warnings);
  nodes.push(name.node, ...brandLine(c, pad, name.bottom + H * 0.01, textW, H * 0.055));
  const priceTop = name.bottom + H * 0.1;
  nodes.push(price(c, { x: pad, y: priceTop, w: textW * 0.5, h: H * 0.86 - priceTop }, TALKER_RED, 'left', H * 0.26));
  if (photoW) nodes.push(...photo(c, { x: W - pad - photoW, y: bannerH + H * 0.06, w: photoW, h: H * 0.72 }));
  nodes.push(...footer(c, { x: W * 0.25, y: H * 0.9, w: W * 0.5, h: H * 0.04 }));
  return { nodes, warnings };
}

function limitedTime(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const pad = H * 0.1;
  const inset = H * 0.05;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: inset, yMm: inset, wMm: W - inset * 2, hMm: H - inset * 2, fill: OFFER_YELLOW }];
  const badge = (c.headline || 'WOW').toUpperCase();
  const bh = H * 0.08;
  nodes.push({ kind: 'rect', xMm: pad, yMm: H * 0.16, wMm: Math.max(bh * 2.4, badge.length * bh * 0.62), hMm: bh, fill: TALKER_RED, radiusMm: bh / 2 });
  nodes.push(t([badge], pad, H * 0.16 + bh * 0.12, Math.max(bh * 2.4, badge.length * bh * 0.62), bh * 0.7, { colour: '#FFFFFF', align: 'center' }));
  const photoW = hasPhoto(c) ? W * 0.2 : 0;
  const textW = W - pad * 2 - photoW - W * 0.03;
  const name = nameBlock(c, { x: pad, y: H * 0.3, w: textW, h: H * 0.2 }, H * 0.1, warnings);
  nodes.push(name.node, ...brandLine(c, pad, name.bottom, textW, H * 0.055, { colour: '#4A4A4A' }));
  const priceTop = name.bottom + H * 0.09;
  nodes.push(price(c, { x: pad, y: priceTop, w: textW * 0.5, h: H * 0.86 - priceTop }, INK, 'left', H * 0.24));
  if (photoW) nodes.push(...photo(c, { x: W - pad - photoW, y: H * 0.08, w: photoW, h: H * 0.84 }));
  nodes.push(...footer(c, { x: W * 0.25, y: H * 0.9, w: W * 0.5, h: H * 0.04 }));
  return { nodes, warnings };
}

function sidePanel(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const pad = H * 0.1;
  const panelX = W * 0.66;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: panelX, yMm: H * 0.08, wMm: W - panelX - H * 0.06, hMm: H * 0.84, fill: TALKER_RED }];
  const headline = c.offer ? `${c.offer.quantity} FOR ${formatPounds(c.offer.totalMinor, true)}` : (c.headline || 'WOW').toUpperCase();
  const pw = W - panelX - H * 0.06;
  const hf = fit(headline, pw * 0.8, H * 0.2);
  nodes.push(t([headline], panelX, H / 2 - hf * 0.58, pw, hf, { colour: '#FFFFFF', align: 'center' }));
  const textW = panelX - pad * 2;
  const name = nameBlock(c, { x: pad, y: H * 0.18, w: textW, h: H * 0.2 }, H * 0.1, warnings);
  nodes.push(name.node, ...brandLine(c, pad, name.bottom, textW, H * 0.055));
  const priceTop = name.bottom + H * 0.06;
  const priceNode = price(c, { x: pad, y: priceTop, w: textW * 0.42, h: H * 0.3 }, INK, 'left', H * 0.2);
  nodes.push(priceNode);
  if (c.priceMinor != null && priceNode.kind === 'text') {
    const pw2 = formatPounds(c.priceMinor).length * priceNode.fontMm * 0.62;
    nodes.push(t(['each'], pad + pw2 + H * 0.02, priceNode.yMm + priceNode.fontMm * 0.6, H * 0.3, H * 0.05, { weight: '400', colour: GREY }));
  }
  nodes.push(...footer(c, { x: pad, y: H * 0.8, w: textW * 0.7, h: H * 0.04 }));
  return { nodes, warnings };
}

function wasNowWide(c: TalkerContent, W: number, H: number, compact: boolean): Body {
  const warnings: string[] = [];
  const pad = H * 0.1;
  const name = nameBlock(c, { x: pad, y: H * 0.14, w: W - pad * 2, h: H * 0.2 }, H * (compact ? 0.09 : 0.1), warnings);
  const nodes: CompositionNode[] = [name.node];
  if (!compact) nodes.push(...brandLine(c, pad, name.bottom, W - pad * 2, H * 0.055));
  const hasWas = c.wasMinor != null;
  const priceX = hasWas ? W * 0.4 : W * 0.2;
  const priceW = hasWas ? W * 0.5 : W * 0.6;
  const capF = H * 0.05;
  const top = H * (compact ? 0.4 : 0.38);
  if (hasWas) {
    const was = formatPounds(c.wasMinor!);
    nodes.push(t(['WAS'], pad, top, W * 0.3, capF, { colour: GREY }));
    nodes.push(t([was], pad, top + capF * 1.4, W * 0.3, fit(was, W * 0.28, H * 0.2), { colour: GREY, strike: true, weight: '700' }));
  }
  if (!compact || hasWas) nodes.push(t(['NOW'], priceX, top, priceW, capF, { colour: TALKER_RED, align: 'center' }));
  nodes.push(price(c, { x: priceX, y: top + capF * 1.2, w: priceW, h: H * 0.9 - top - capF * 1.2 }, TALKER_RED, 'center', H * 0.3));
  return { nodes, warnings };
}

function multiBuyWide(c: TalkerContent, W: number, H: number, withPhoto: boolean): Body {
  const warnings: string[] = [];
  const inset = H * 0.05;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: inset, yMm: inset, wMm: W - inset * 2, hMm: H - inset * 2, fill: OFFER_YELLOW }];
  const photoW = withPhoto && hasPhoto(c) ? W * 0.1 : 0;
  const areaW = W - photoW - (photoW ? W * 0.06 : 0) - H * 0.2;
  const head = offerHeadline(c);
  if (head) {
    const f = fit(head, areaW * 0.86, H * 0.3);
    nodes.push(t([head], H * 0.1, H * 0.34 - f * 0.1, areaW, f, { align: 'center' }));
  } else {
    nodes.push(needsPrice({ x: H * 0.1, y: H * 0.2, w: areaW, h: H * 0.3 }));
  }
  const caption = c.name.trim().toUpperCase();
  const cf = fitText(caption || ' ', areaW * 0.8, 1, H * 0.06, H * 0.035);
  if (!cf.fits) warnings.push('Name is too long for this design — shorten it');
  nodes.push(t(cf.lines, H * 0.1, H * 0.62, areaW, cf.fontMm, { align: 'center' }));
  if (c.listText?.trim()) nodes.push(t([c.listText.trim()], H * 0.1, H * 0.72, areaW, H * 0.04, { weight: '400', align: 'center' }));
  else nodes.push(...footer(c, { x: H * 0.1, y: H * 0.72, w: areaW, h: H * 0.04 }));
  if (photoW) nodes.push(...photo(c, { x: W - photoW - W * 0.03, y: H * 0.16, w: photoW, h: H * 0.68 }));
  return { nodes, warnings };
}

// ---------- 6 × 3 in ----------

function redBanner(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const pad = H * 0.08;
  const bannerH = H * 0.18;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: pad, yMm: pad, wMm: W - pad * 2, hMm: bannerH, fill: TALKER_RED }];
  const headline = c.offer ? `${c.offer.quantity} FOR ${formatPounds(c.offer.totalMinor, true)}` : (c.headline || 'WOW').toUpperCase();
  nodes.push(t([headline], pad, pad + bannerH * 0.16, W - pad * 2, fit(headline, W * 0.6, bannerH * 0.68), { colour: '#FFFFFF', align: 'center' }));
  const textW = W - pad * 2;
  const name = nameBlock(c, { x: pad * 1.3, y: pad + bannerH + H * 0.06, w: textW, h: H * 0.2 }, H * 0.085, warnings);
  nodes.push(name.node, ...brandLine(c, pad * 1.3, name.bottom, textW, H * 0.05));
  const priceTop = name.bottom + H * 0.08;
  const p = price(c, { x: pad * 1.3, y: priceTop, w: textW * 0.35, h: H * 0.24 }, INK, 'left', H * 0.17);
  nodes.push(p);
  if (c.priceMinor != null) {
    const pw = formatPounds(c.priceMinor).length * p.fontMm * 0.62;
    nodes.push(t(['each'], pad * 1.3 + pw + H * 0.02, p.yMm + p.fontMm * 0.55, H * 0.3, H * 0.045, { weight: '400', colour: GREY }));
  }
  nodes.push(...footer(c, { x: pad * 1.3, y: H * 0.86, w: textW * 0.5, h: H * 0.04 }));
  return { nodes, warnings };
}

// ---------- 4 × 3 in ----------

function circleBadge(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const d = H * 0.62;
  const cx = W / 2;
  const cy = H * 0.42;
  const nodes: CompositionNode[] = [disc(cx, cy, d, TALKER_RED)];
  const word = (c.headline || 'OFFER').toUpperCase();
  nodes.push(t([word], cx - d * 0.45, cy - d * 0.15, d * 0.9, fit(word, d * 0.84, d * 0.3), { colour: '#FFFFFF', align: 'center' }));
  const line = `ON ${c.name.trim().toUpperCase()}`;
  const lf = fitText(line, W * 0.84, 1, H * 0.06, H * 0.035);
  if (!lf.fits) warnings.push('Name is too long for this design — shorten it');
  nodes.push(t(lf.lines, W * 0.08, H * 0.82, W * 0.84, lf.fontMm, { align: 'center' }));
  return { nodes, warnings };
}

// ---------- Alcohol 70 × 70 ----------

function blackLabel(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const f = fitText(c.name.trim() || ' ', W * 0.78, 2, H * 0.11, H * 0.06);
  if (!f.fits) warnings.push('Name is too long for this design — shorten it');
  const nodes: CompositionNode[] = [t(f.lines, W * 0.11, H * 0.2, W * 0.78, f.fontMm, { align: 'center', underline: true })];
  nodes.push(price(c, { x: W * 0.08, y: H * 0.48, w: W * 0.84, h: H * 0.3 }, TALKER_RED, 'center', H * 0.24));
  return { nodes, warnings };
}

function wowSquare(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const d = W * 0.66;
  const cx = W / 2;
  const cy = H * 0.44;
  const nodes: CompositionNode[] = [disc(cx, cy, d, TALKER_RED)];
  const word = (c.headline || 'WOW').toUpperCase();
  nodes.push(t([word], cx - d / 2, cy - d * 0.3, d, d * 0.13, { colour: WOW_YELLOW, align: 'center' }));
  nodes.push(c.priceMinor != null ? price(c, { x: cx - d * 0.4, y: cy - d * 0.16, w: d * 0.8, h: d * 0.36 }, '#FFFFFF', 'center') : needsPrice({ x: cx - d / 2, y: cy - d * 0.1, w: d, h: d * 0.3 }));
  const cap = fitText(c.name.trim().toUpperCase() || ' ', W * 0.84, 1, H * 0.055, H * 0.035);
  if (!cap.fits) warnings.push('Name is too long for this design — shorten it');
  nodes.push(t(cap.lines, W * 0.08, H * 0.84, W * 0.84, cap.fontMm, { align: 'center' }));
  return { nodes, warnings };
}

function wasNowSquare(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const f = fitText(c.name.trim() || ' ', W * 0.8, 2, H * 0.065, H * 0.04);
  if (!f.fits) warnings.push('Name is too long for this design — shorten it');
  const nodes: CompositionNode[] = [t(f.lines, W * 0.1, H * 0.32, W * 0.8, f.fontMm, { align: 'center', weight: '700' })];
  let priceTop = H * 0.32 + f.lines.length * f.fontMm * 1.15 + H * 0.03;
  if (c.wasMinor != null) {
    const was = formatPounds(c.wasMinor);
    nodes.push(t([`Was ${was}`], W * 0.1, priceTop, W * 0.8, H * 0.07, { align: 'center', colour: GREY, strike: true, weight: '700' }));
    priceTop += H * 0.1;
  }
  nodes.push(price(c, { x: W * 0.1, y: priceTop, w: W * 0.8, h: H * 0.22 }, TALKER_RED, 'center', H * 0.16));
  return { nodes, warnings };
}

function multiBuySquare(c: TalkerContent, W: number, H: number): Body {
  const warnings: string[] = [];
  const inset = W * 0.04;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: inset, yMm: inset, wMm: W - inset * 2, hMm: H - inset * 2, fill: OFFER_YELLOW }];
  const top = c.offer ? `${c.offer.quantity} FOR` : (c.headline || 'OFFER').toUpperCase();
  const bottom = c.offer ? formatPounds(c.offer.totalMinor, true) : c.priceMinor != null ? formatPounds(c.priceMinor) : null;
  nodes.push(t([top], inset, H * 0.26, W - inset * 2, fit(top, W * 0.6, H * 0.14), { align: 'center' }));
  if (bottom) nodes.push(t([bottom], inset, H * 0.42, W - inset * 2, fit(bottom, W * 0.8, H * 0.24), { align: 'center' }));
  else nodes.push(needsPrice({ x: inset, y: H * 0.42, w: W - inset * 2, h: H * 0.2 }));
  const cap = fitText(c.name.trim().toUpperCase() || ' ', W * 0.8, 1, H * 0.05, H * 0.03);
  if (!cap.fits) warnings.push('Name is too long for this design — shorten it');
  nodes.push(t(cap.lines, W * 0.1, H * 0.72, W * 0.8, cap.fontMm, { align: 'center' }));
  if (c.listText?.trim()) nodes.push(t([c.listText.trim()], W * 0.1, H * 0.8, W * 0.8, H * 0.035, { weight: '400', align: 'center' }));
  return { nodes, warnings };
}

// ---------- WOW circle on the left (8×3, 6×3, 4×3) ----------

function wowLeft(c: TalkerContent, W: number, H: number, photoRight: boolean): Body {
  const warnings: string[] = [];
  const pad = H * 0.09;
  const d = H * 0.62;
  const cx = pad + d / 2;
  const cy = H / 2;
  const nodes: CompositionNode[] = [disc(cx, cy, d, TALKER_RED)];
  nodes.push(c.priceMinor != null ? price(c, { x: cx - d * 0.42, y: cy - d * 0.22, w: d * 0.84, h: d * 0.44 }, '#FFFFFF', 'center') : needsPrice({ x: cx - d / 2, y: cy - d / 4, w: d, h: d / 2 }));
  const photoW = photoRight && hasPhoto(c) ? W * 0.16 : 0;
  const textX = pad + d + W * 0.03;
  const textW = W - textX - pad - photoW - (photoW ? W * 0.02 : 0);
  const name = nameBlock(c, { x: textX, y: H * 0.36, w: textW, h: H * 0.2 }, H * 0.075, warnings);
  nodes.push(name.node, ...brandLine(c, textX, name.bottom, textW, H * 0.045));
  if (photoW) nodes.push(...photo(c, { x: W - pad - photoW, y: H * 0.14, w: photoW, h: H * 0.72 }));
  return { nodes, warnings };
}

// ---------- Registry ----------

type TemplateRenderer = (c: TalkerContent, W: number, H: number) => Body;

const RENDERERS: Record<string, TemplateRenderer> = {
  T01: (c, W, H) => wowCircleShelf(c, W, H, true),
  T02: specialOffer,
  T03: limitedTime,
  T04: blackLabel,
  T05: wowSquare,
  T06: wasNowSquare,
  T07: multiBuySquare,
  T08: sidePanel,
  T09: (c, W, H) => wowLeft(c, W, H, true),
  T10: (c, W, H) => wasNowWide(c, W, H, false),
  T11: (c, W, H) => multiBuyWide(c, W, H, true),
  T12: redBanner,
  T13: (c, W, H) => wowLeft(c, W, H, true),
  T14: (c, W, H) => wasNowWide(c, W, H, false),
  T15: (c, W, H) => multiBuyWide(c, W, H, false),
  T16: circleBadge,
  T17: (c, W, H) => wowLeft(c, W, H, false),
  T18: (c, W, H) => wasNowWide(c, W, H, true),
  T19: (c, W, H) => multiBuyWide(c, W, H, false),
};

export const TALKER_TEMPLATE_IDS = Object.keys(RENDERERS);

export function hasTalkerRenderer(templateId: string) {
  return templateId in RENDERERS;
}

export function renderTalker(templateId: string, content: TalkerContent): LabelComposition {
  const template = TEMPLATES.find((tpl) => tpl.id === templateId);
  const render = RENDERERS[templateId];
  if (!template || !render) throw new Error(`No renderer for template ${templateId}`);
  const size = LABEL_SIZES[template.sizeId];
  const body = render(content, size.widthMm, size.heightMm);
  return { widthMm: size.widthMm, heightMm: size.heightMm, nodes: body.nodes, warnings: body.warnings };
}

/** Catalogue fixture (reference thumbnails): Sample product / Brand / £1.99 + red bottle. */
export const TALKER_FIXTURE: TalkerContent = {
  name: 'Sample product',
  brand: 'Brand',
  priceMinor: 199,
  fixtureArt: true,
};
