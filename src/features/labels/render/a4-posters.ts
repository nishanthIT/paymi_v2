/**
 * A4 poster renderer for catalogue templates T20–T29 (portrait 210 × 297,
 * landscape 297 × 210). Duo/trio designs take one content per product slot;
 * twin-photo heroes (T27, T28) draw the same product's photo on both sides.
 */
import { TEMPLATES } from '../registry/manifest';
import { LABEL_SIZES } from '../registry/sizes';
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import { fitText, formatPounds, INK } from './shelf-label';
import {
  disc,
  fit,
  footer,
  hasPhoto,
  needsPrice,
  photo,
  price,
  t,
  TALKER_RED,
  type TalkerContent,
} from './shelf-talkers';

export const POSTER_ORANGE = '#F2702A';
export const TRIPTYCH_BLUE = '#1E3FA0';
export const DUO_PURPLE = '#5B34C9';
const GREY = '#6E7176';

type Box = { x: number; y: number; w: number; h: number };
type Body = { nodes: CompositionNode[]; warnings: string[] };
/** Poster-wide text shared by every slot. */
export interface PosterShared {
  headline?: string;
  footer?: string;
}

const EMPTY: TalkerContent = { name: '' };

function banner(x: number, y: number, w: number, h: number, fill: string, label: string): CompositionNode[] {
  return [
    { kind: 'rect', xMm: x, yMm: y, wMm: w, hMm: h, fill },
    t([label], x, y + h * 0.18, w, h * 0.6, { colour: '#FFFFFF', align: 'center' }),
  ];
}

function nameLines(c: TalkerContent, box: Box, maxFont: number, warnings: string[], extra: Partial<Extract<CompositionNode, { kind: 'text' }>> = {}, upper = false) {
  const raw = c.name.trim();
  const f = fitText((upper ? raw.toUpperCase() : raw) || ' ', box.w, 2, maxFont, Math.max(4, maxFont * 0.5));
  if (raw && !f.fits) warnings.push(`“${raw}” is too long for this design — shorten it`);
  return { node: t(f.lines, box.x, box.y, box.w, f.fontMm, { weight: '700', ...extra }), bottom: box.y + f.lines.length * f.fontMm * 1.15 };
}

/** Preview-only prompt for an empty product slot; it never prints. */
function emptySlot(box: Box, index: number, colour = '#9CA0A6'): CompositionNode {
  return t([`Add product ${index + 1}`], box.x, box.y + box.h / 2 - 3, box.w, Math.min(6, box.h * 0.12), {
    colour,
    align: 'center',
    weight: '600',
    previewOnly: true,
  });
}

const filled = (c: TalkerContent | null | undefined): c is TalkerContent => !!c && !!c.name.trim();

// ---------- Portrait ----------

function heroPoster(c: TalkerContent, W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 12;
  const nodes: CompositionNode[] = [...banner(m, m, W - m * 2, 26, TALKER_RED, (s.headline || 'WOW').toUpperCase())];
  const head = nameLines(c, { x: m, y: m + 36, w: W - m * 2, h: 30 }, 14, warnings, { colour: POSTER_ORANGE, align: 'center', weight: '800' }, true);
  nodes.push(head.node);
  if (c.brand) nodes.push(t([c.brand], m, head.bottom + 2, W - m * 2, 5, { weight: '400', colour: GREY, align: 'center' }));
  const heroBox = { x: 22, y: 110, w: 78, h: 110 };
  if (hasPhoto(c)) nodes.push(...photo(c, heroBox));
  const priceBox = hasPhoto(c) ? { x: 108, y: 135, w: 88, h: 60 } : { x: m, y: 125, w: W - m * 2, h: 80 };
  nodes.push(price(c, priceBox, INK, hasPhoto(c) ? 'center' : 'center'));
  nodes.push(...footer({ ...c, footer: s.footer }, { x: W * 0.3, y: H - 22, w: W * 0.4, h: 4 }));
  return { nodes, warnings };
}

function triptych(cs: (TalkerContent | null)[], W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 8;
  const bottomPad = 22;
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: m, yMm: m, wMm: W - m * 2, hMm: H - m - bottomPad, fill: TRIPTYCH_BLUE }];
  const panelH = (H - m - bottomPad) / 3;
  for (let i = 0; i < 3; i++) {
    const y = m + i * panelH;
    if (i > 0) nodes.push({ kind: 'rect', xMm: m, yMm: y - 0.6, wMm: W - m * 2, hMm: 1.2, fill: '#5C79D6' });
    const c = cs[i];
    const box = { x: m, y, w: W - m * 2, h: panelH };
    if (!filled(c)) {
      nodes.push(emptySlot(box, i, '#C9D3F2'));
      continue;
    }
    const d = panelH * 0.52;
    const cx = m + 12 + d / 2;
    const cy = y + panelH / 2;
    nodes.push(disc(cx, cy, d, TALKER_RED));
    nodes.push(c.priceMinor != null ? price(c, { x: cx - d * 0.42, y: cy - d * 0.22, w: d * 0.84, h: d * 0.44 }, '#FFFFFF', 'center') : { ...needsPrice({ x: cx - d / 2, y: cy - 4, w: d, h: 8 }), colour: '#FFFFFF' });
    const photoW = hasPhoto(c) ? 38 : 0;
    const textX = cx + d / 2 + 8;
    const textW = W - m - 10 - photoW - textX - 4;
    const name = nameLines(c, { x: textX, y: cy - 7, w: textW, h: 14 }, 7, warnings, { colour: '#FFFFFF' });
    nodes.push(name.node);
    if (c.brand) nodes.push(t([c.brand], textX, name.bottom + 1, textW, 4, { weight: '400', colour: '#C9D3F2' }));
    if (photoW) {
      nodes.push({ kind: 'rect', xMm: W - m - 10 - photoW, yMm: y + panelH * 0.18, wMm: photoW, hMm: panelH * 0.64, fill: '#FFFFFF' });
      nodes.push(...photo(c, { x: W - m - 10 - photoW + 2, y: y + panelH * 0.2, w: photoW - 4, h: panelH * 0.6 }));
    }
  }
  nodes.push(...footer({ ...EMPTY, fixtureArt: cs.some((c) => c?.fixtureArt), footer: s.footer }, { x: W * 0.3, y: H - 14, w: W * 0.4, h: 4 }));
  return { nodes, warnings };
}

function simpleTrio(cs: (TalkerContent | null)[], W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 12;
  const nodes: CompositionNode[] = [...banner(m, m, W - m * 2, 10, TALKER_RED, (s.headline || 'WOW').toUpperCase())];
  const colW = (W - m * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const x = m + i * colW;
    const c = cs[i];
    const box = { x: x + 3, y: m + 16, w: colW - 6, h: 80 };
    if (!filled(c)) {
      nodes.push(emptySlot(box, i));
      continue;
    }
    const name = nameLines(c, { x: x + 3, y: m + 16, w: colW - 6, h: 10 }, 5, warnings, { align: 'center' });
    nodes.push(name.node);
    if (c.brand) nodes.push(t([c.brand], x + 3, name.bottom + 0.5, colW - 6, 3, { weight: '400', colour: GREY, align: 'center' }));
    if (hasPhoto(c)) nodes.push(...photo(c, { x: x + colW * 0.2, y: m + 32, w: colW * 0.6, h: 42 }));
    nodes.push(price(c, { x: x + 3, y: m + 78, w: colW - 6, h: 12 }, INK, 'center', 10));
  }
  nodes.push(...footer({ ...EMPTY, fixtureArt: cs.some((c) => c?.fixtureArt), footer: s.footer }, { x: W * 0.3, y: H - 22, w: W * 0.4, h: 4 }));
  return { nodes, warnings };
}

function stackedDuo(cs: (TalkerContent | null)[], W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 14;
  const blockH = (H - m * 2 - 20) / 2;
  const nodes: CompositionNode[] = [];
  for (let i = 0; i < 2; i++) {
    const y = m + i * (blockH + 6);
    const c = cs[i];
    const box = { x: m, y, w: W - m * 2, h: blockH };
    if (!filled(c)) {
      nodes.push(emptySlot(box, i));
      continue;
    }
    const photoW = hasPhoto(c) ? 80 : 0;
    if (photoW) nodes.push(...photo(c, { x: m, y: y + 6, w: photoW, h: blockH - 12 }));
    const textX = m + photoW + (photoW ? 12 : 0);
    const textW = W - m - textX;
    const name = nameLines(c, { x: textX, y: y + blockH * 0.28, w: textW, h: 24 }, 10, warnings, { weight: '800' }, true);
    nodes.push(name.node);
    nodes.push(price(c, { x: textX, y: name.bottom + 4, w: textW * 0.8, h: 30 }, INK, 'left', 26));
  }
  nodes.push(...footer({ ...EMPTY, fixtureArt: cs.some((c) => c?.fixtureArt), footer: s.footer }, { x: W * 0.3, y: H - 16, w: W * 0.4, h: 4 }));
  return { nodes, warnings };
}

// ---------- Landscape ----------

function heroLandscape(c: TalkerContent, W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 14;
  const nodes: CompositionNode[] = [];
  const photoW = hasPhoto(c) ? 118 : 0;
  if (photoW) nodes.push(...photo(c, { x: m, y: m + 6, w: photoW, h: H - m * 2 - 22 }));
  const x = m + photoW + (photoW ? 14 : 0);
  const w = W - x - m;
  const badge = (s.headline || 'WOW').toUpperCase();
  nodes.push({ kind: 'rect', xMm: x, yMm: 52, wMm: Math.max(18, badge.length * 4.2), hMm: 8, fill: TALKER_RED });
  nodes.push(t([badge], x, 53.4, Math.max(18, badge.length * 4.2), 5.2, { colour: '#FFFFFF', align: 'center' }));
  const name = nameLines(c, { x, y: 66, w, h: 22 }, 11, warnings, { weight: '800' }, true);
  nodes.push(name.node);
  if (c.brand) nodes.push(t([c.brand], x, name.bottom + 1.5, w, 4.5, { weight: '400', colour: GREY }));
  nodes.push(price(c, { x, y: name.bottom + 10, w: w * 0.8, h: 44 }, INK, 'left', 40));
  if (c.packSize) nodes.push(t([c.packSize], x, name.bottom + 58, w, 4, { weight: '400', colour: GREY }));
  nodes.push(...footer({ ...c, footer: s.footer }, { x: W * 0.35, y: H - 14, w: W * 0.3, h: 4 }));
  return { nodes, warnings };
}

function columnsLandscape(cs: (TalkerContent | null)[], W: number, H: number, s: PosterShared, count: 2 | 3): Body {
  const warnings: string[] = [];
  const m = 14;
  const bannerFill = count === 2 ? DUO_PURPLE : TALKER_RED;
  const nodes: CompositionNode[] = [...banner(m, m, W - m * 2, 11, bannerFill, (s.headline || 'WOW').toUpperCase())];
  const colW = (W - m * 2) / count;
  for (let i = 0; i < count; i++) {
    const x = m + i * colW;
    const c = cs[i];
    const box = { x: x + 6, y: m + 18, w: colW - 12, h: H - m * 2 - 40 };
    if (!filled(c)) {
      nodes.push(emptySlot(box, i));
      continue;
    }
    if (count === 3) {
      // Strip: name on top, photo, round red price badge.
      const name = nameLines(c, { x: x + 6, y: m + 18, w: colW - 12, h: 10 }, 5, warnings, { align: 'center' });
      nodes.push(name.node);
      if (c.brand) nodes.push(t([c.brand], x + 6, name.bottom + 0.5, colW - 12, 3.2, { weight: '400', colour: GREY, align: 'center' }));
      if (hasPhoto(c)) nodes.push(...photo(c, { x: x + colW * 0.22, y: m + 36, w: colW * 0.56, h: 88 }));
      const d = 30;
      const cx = x + colW / 2;
      const cy = H - m - 34;
      nodes.push(disc(cx, cy, d, TALKER_RED));
      nodes.push(c.priceMinor != null ? price(c, { x: cx - d * 0.42, y: cy - d * 0.22, w: d * 0.84, h: d * 0.44 }, '#FFFFFF', 'center') : { ...needsPrice({ x: cx - d / 2, y: cy - 3, w: d, h: 6 }), colour: '#FFFFFF' });
    } else {
      // Duo: photo on its tile, name + brand, red price below.
      if (hasPhoto(c)) nodes.push(...photo(c, { x: x + colW * 0.2, y: m + 20, w: colW * 0.6, h: 96 }));
      const name = nameLines(c, { x: x + 6, y: m + 122, w: colW - 12, h: 12 }, 5.5, warnings, { align: 'center' });
      nodes.push(name.node);
      if (c.brand) nodes.push(t([c.brand], x + 6, name.bottom + 0.5, colW - 12, 3.5, { weight: '400', colour: GREY, align: 'center' }));
      nodes.push(price(c, { x: x + 6, y: m + 142, w: colW - 12, h: 20 }, TALKER_RED, 'center', 16));
    }
  }
  nodes.push(...footer({ ...EMPTY, fixtureArt: cs.some((c) => c?.fixtureArt), footer: s.footer }, { x: W * 0.35, y: H - 12, w: W * 0.3, h: 4 }));
  return { nodes, warnings };
}

/** Ribbon Hero (T27) and Bold Title (T28): one product, photo repeated left and right. */
function twinHero(c: TalkerContent, W: number, H: number, s: PosterShared, bold: boolean): Body {
  const warnings: string[] = [];
  const m = 14;
  const ribbon = (s.headline || 'WOW').toUpperCase();
  const rw = Math.max(26, ribbon.length * 5);
  const nodes: CompositionNode[] = [
    { kind: 'rect', xMm: (W - rw) / 2, yMm: m + 6, wMm: rw, hMm: 9, fill: TALKER_RED },
    t([ribbon], (W - rw) / 2, m + 7.6, rw, 5.6, { colour: '#FFFFFF', align: 'center' }),
  ];
  const title = nameLines(
    c,
    { x: m + 20, y: m + 22, w: W - m * 2 - 40, h: bold ? 34 : 18 },
    bold ? 22 : 11,
    warnings,
    { colour: bold ? TALKER_RED : POSTER_ORANGE, align: 'center', weight: '800' },
    true,
  );
  nodes.push(title.node);
  let textBottom = title.bottom;
  if (bold && c.brand) {
    nodes.push(t([c.brand], m, title.bottom + 1, W - m * 2, 5, { weight: '400', colour: TALKER_RED, align: 'center', italic: true }));
    textBottom += 7;
  }
  const photoW = 48;
  const photoY = Math.max(H * 0.4, textBottom + 8);
  const photoH = Math.min(H * 0.42, H - 24 - photoY);
  if (hasPhoto(c)) {
    // Same product both sides — never a different product in the twin slot.
    nodes.push(...photo(c, { x: m + 14, y: photoY, w: photoW, h: photoH }));
    nodes.push(...photo(c, { x: W - m - 14 - photoW, y: photoY, w: photoW, h: photoH }));
  }
  const priceBox = { x: m + photoW + 34, y: photoY + photoH * 0.18, w: W - (m + photoW + 34) * 2, h: photoH * 0.62 };
  if (!bold && c.priceMinor != null) {
    const value = formatPounds(c.priceMinor);
    const f = fit(`${value}`, priceBox.w * 0.78, priceBox.h);
    const onlyF = f * 0.34;
    nodes.push(t(['ONLY'], priceBox.x, priceBox.y + (priceBox.h - f * 1.15) / 2 + f * 0.62, priceBox.w * 0.2, onlyF, { italic: true, align: 'right', weight: '700' }));
    nodes.push(t([value], priceBox.x + priceBox.w * 0.22, priceBox.y + (priceBox.h - f * 1.15) / 2, priceBox.w * 0.78, f, { align: 'left' }));
  } else {
    nodes.push(price(c, priceBox, INK, 'center'));
  }
  nodes.push(...footer({ ...c, footer: s.footer }, { x: W * 0.35, y: H - 14, w: W * 0.3, h: 4 }));
  return { nodes, warnings };
}

function priceHero(c: TalkerContent, W: number, H: number, s: PosterShared): Body {
  const warnings: string[] = [];
  const m = 14;
  const badge = (s.headline || 'WOW').toUpperCase();
  const bw = Math.max(16, badge.length * 3.6);
  const nodes: CompositionNode[] = [
    { kind: 'rect', xMm: W - m - bw, yMm: m, wMm: bw, hMm: 7, fill: TALKER_RED },
    t([badge], W - m - bw, m + 1.2, bw, 4.6, { colour: '#FFFFFF', align: 'center' }),
  ];
  nodes.push(price(c, { x: m + 20, y: m + 10, w: W - m * 2 - 40, h: 62 }, INK, 'center'));
  const cap = nameLines(c, { x: m + 40, y: m + 78, w: W - m * 2 - 80, h: 10 }, 5.5, warnings, { align: 'center' });
  nodes.push(cap.node);
  if (hasPhoto(c)) nodes.push(...photo(c, { x: W / 2 - 30, y: cap.bottom + 4, w: 60, h: H - cap.bottom - 4 - m - 14 }));
  nodes.push(...footer({ ...c, footer: s.footer }, { x: W * 0.35, y: H - 12, w: W * 0.3, h: 4 }));
  return { nodes, warnings };
}

// ---------- Registry ----------

type PosterRenderer = (cs: (TalkerContent | null)[], W: number, H: number, s: PosterShared) => Body;

const single = (fn: (c: TalkerContent, W: number, H: number, s: PosterShared) => Body): PosterRenderer => (cs, W, H, s) =>
  fn(cs[0] ?? EMPTY, W, H, s);

const RENDERERS: Record<string, PosterRenderer> = {
  T20: single(heroPoster),
  T21: triptych,
  T22: simpleTrio,
  T23: stackedDuo,
  T24: single(heroLandscape),
  T25: (cs, W, H, s) => columnsLandscape(cs, W, H, s, 2),
  T26: (cs, W, H, s) => columnsLandscape(cs, W, H, s, 3),
  T27: single((c, W, H, s) => twinHero(c, W, H, s, false)),
  T28: single((c, W, H, s) => twinHero(c, W, H, s, true)),
  T29: single(priceHero),
};

export const POSTER_TEMPLATE_IDS = Object.keys(RENDERERS);

export function hasPosterRenderer(templateId: string) {
  return templateId in RENDERERS;
}

export function renderPoster(templateId: string, contents: (TalkerContent | null)[], shared: PosterShared = {}): LabelComposition {
  const template = TEMPLATES.find((tpl) => tpl.id === templateId);
  const render = RENDERERS[templateId];
  if (!template || !render) throw new Error(`No poster renderer for ${templateId}`);
  const size = LABEL_SIZES[template.sizeId];
  const body = render(contents, size.widthMm, size.heightMm, shared);
  return { widthMm: size.widthMm, heightMm: size.heightMm, nodes: body.nodes, warnings: body.warnings };
}

/** Reference multi-product fixtures: Sample product 1–3 at £1.99 / £2.99 / £3.99. */
export const POSTER_FIXTURES: TalkerContent[] = [
  { name: 'Sample product 1', brand: 'Brand', priceMinor: 199, fixtureArt: true, fixtureKind: 'bottle' },
  { name: 'Sample product 2', brand: 'Brand', priceMinor: 299, fixtureArt: true, fixtureKind: 'container' },
  { name: 'Sample product 3', brand: 'Brand', priceMinor: 399, fixtureArt: true, fixtureKind: 'pack' },
];

export const SINGLE_POSTER_FIXTURE: TalkerContent = {
  name: 'Sample product',
  brand: 'Brand',
  packSize: 'Sample caption',
  priceMinor: 199,
  fixtureArt: true,
  fixtureKind: 'bottle',
};
