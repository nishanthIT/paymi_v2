/**
 * Mixed-sheet composition (pure): fixed-cell sheets and Custom packing.
 * Labels are placed at their exact physical size — never scaled or rotated;
 * a label that can't fit is reported, and overflow starts a new page.
 */
import type { LabelItem } from '../model/label-item';
import { isCustomLayout, unplacedEntries, type MixedEntry, type MixedState } from '../model/mixed';
import { CUSTOM_SPACING, DEFAULT_MIXED_SHEET, MIXED_CELLS, SIZE_LABEL } from '../registry/mixed-geometry';
import { LABEL_SIZES, type PhysicalSize } from '../registry/sizes';
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import { itemPrintIssues } from './print-checks';
import { itemToTalkerContent } from './talker-settings';
import { renderTemplate } from './templates';

const EPS = 0.01;
const GUIDE = '#A9C4EC';

export function translateNodes(nodes: CompositionNode[], dx: number, dy: number): CompositionNode[] {
  return nodes.map((n) => ({ ...n, xMm: n.xMm + dx, yMm: n.yMm + dy }));
}

/** The entry's label artwork at its own physical size (null until a design is chosen). */
export function renderEntry(entry: MixedEntry, item: LabelItem | undefined): LabelComposition | null {
  if (!entry.templateId) return null;
  const c = renderTemplate(entry.templateId, [itemToTalkerContent(item, entry)]);
  const size = LABEL_SIZES[entry.sizeId];
  if (Math.abs(c.widthMm - size.widthMm) > EPS || Math.abs(c.heightMm - size.heightMm) > EPS) {
    throw new Error(`${entry.templateId} is ${c.widthMm} × ${c.heightMm} mm and can't go in a ${size.displayName} slot`);
  }
  return c;
}

/** Problems that block export of this label (never silently dropped). */
export function entryIssues(entry: MixedEntry, item: LabelItem | undefined, c: LabelComposition | null): string[] {
  if (!entry.templateId || !c) return ['Choose a design'];
  if (!item) return ['Add a product'];
  return itemPrintIssues(item, c, { checkCopies: false });
}

// ---------- Custom packing ----------

export interface PackBlock {
  key: string;
  wMm: number;
  hMm: number;
}
export interface Placement extends PackBlock {
  xMm: number;
  yMm: number;
}

/**
 * Deterministic row packing in the owner's order: left → right in centred
 * rows, top → bottom, new page when the next row doesn't fit.
 */
export function packCustom(
  blocks: PackBlock[],
  page: PhysicalSize = DEFAULT_MIXED_SHEET.page,
  s = CUSTOM_SPACING,
): { pages: Placement[][]; unfit: string[] } {
  const maxW = page.widthMm - 2 * s.marginXMm;
  const bottom = page.heightMm - s.marginYMm;
  const pages: Placement[][] = [];
  const unfit: string[] = [];
  let current: Placement[] = [];
  let row: PackBlock[] = [];
  let rowW = 0;
  let rowH = 0;
  let y = s.marginYMm;

  const flushRow = () => {
    if (!row.length) return;
    let x = (page.widthMm - rowW) / 2;
    for (const b of row) {
      current.push({ ...b, xMm: x, yMm: y });
      x += b.wMm + s.gapXMm;
    }
    y += rowH + s.gapYMm;
    row = [];
    rowW = 0;
    rowH = 0;
  };

  for (const b of blocks) {
    if (b.wMm > maxW + EPS || b.hMm > bottom - s.marginYMm + EPS) {
      unfit.push(b.key);
      continue;
    }
    const fitsRow = row.length > 0 && rowW + s.gapXMm + b.wMm <= maxW + EPS && y + Math.max(rowH, b.hMm) <= bottom + EPS;
    if (!fitsRow) {
      flushRow();
      if (y + b.hMm > bottom + EPS) {
        pages.push(current);
        current = [];
        y = s.marginYMm;
      }
    }
    rowW = row.length ? rowW + s.gapXMm + b.wMm : b.wMm;
    rowH = Math.max(rowH, b.hMm);
    row.push(b);
  }
  flushRow();
  if (current.length) pages.push(current);
  return { pages, unfit };
}

// ---------- Job (preview = export) ----------

export interface MixedIssue {
  slot: number;
  entryId: string;
  message: string;
}

export interface MixedJob {
  pages: LabelComposition[];
  issues: MixedIssue[];
  /** Labels that would print (fixed: filled cells; Custom: every entry). */
  filled: number;
  /** Fixed layouts: entries kept from an earlier layout that aren't on this one. */
  unplaced: MixedEntry[];
}

function slotGuide(x: number, y: number, w: number, h: number, caption?: string): CompositionNode[] {
  const nodes: CompositionNode[] = [{ kind: 'rect', xMm: x, yMm: y, wMm: w, hMm: h, stroke: GUIDE, previewOnly: true }];
  if (caption) {
    nodes.push({
      kind: 'text',
      xMm: x,
      yMm: y + h / 2 - 4,
      wMm: w,
      lines: [caption],
      fontMm: 7,
      lineHeightMm: 8,
      weight: '600',
      align: 'center',
      colour: '#B3B6BD',
      previewOnly: true,
    });
  }
  return nodes;
}

export function buildMixedJob(state: MixedState, items: LabelItem[]): MixedJob {
  const page = DEFAULT_MIXED_SHEET.page;
  const itemOf = (e: MixedEntry) => items.find((i) => i.id === e.itemId);
  const issues: MixedIssue[] = [];
  const blank = (nodes: CompositionNode[]): LabelComposition => ({ widthMm: page.widthMm, heightMm: page.heightMm, nodes, warnings: [] });

  if (!isCustomLayout(state.layoutId)) {
    const rects = MIXED_CELLS[state.layoutId] ?? [];
    const nodes: CompositionNode[] = [];
    let filled = 0;
    rects.forEach((r, i) => {
      const entry = state.entries.find((e) => e.id === state.cells[i]);
      if (!entry) {
        nodes.push(...slotGuide(r.xMm, r.yMm, r.wMm, r.hMm, String(i + 1)));
        return;
      }
      filled += 1;
      const c = renderEntry(entry, itemOf(entry));
      if (c) nodes.push(...translateNodes(c.nodes, r.xMm, r.yMm));
      nodes.push(...slotGuide(r.xMm, r.yMm, r.wMm, r.hMm, c ? undefined : 'Choose a design'));
      for (const message of entryIssues(entry, itemOf(entry), c)) issues.push({ slot: i + 1, entryId: entry.id, message });
    });
    return { pages: rects.length ? [blank(nodes)] : [], issues, filled, unplaced: unplacedEntries(state) };
  }

  const blocks: PackBlock[] = [];
  state.entries.forEach((entry) => {
    const size = LABEL_SIZES[entry.sizeId];
    for (let k = 0; k < Math.max(1, entry.copies); k++) blocks.push({ key: `${entry.id}#${k}`, wMm: size.widthMm, hMm: size.heightMm });
  });
  const packed = packCustom(blocks, page);
  const slotOf = (entryId: string) => state.entries.findIndex((e) => e.id === entryId) + 1;
  const comps = new Map(state.entries.map((e) => [e.id, renderEntry(e, itemOf(e))]));
  state.entries.forEach((entry) => {
    for (const message of entryIssues(entry, itemOf(entry), comps.get(entry.id) ?? null)) {
      issues.push({ slot: slotOf(entry.id), entryId: entry.id, message });
    }
  });
  for (const id of new Set(packed.unfit.map((k) => k.split('#')[0]))) {
    const entry = state.entries.find((e) => e.id === id)!;
    issues.push({
      slot: slotOf(id),
      entryId: id,
      message: `${SIZE_LABEL[entry.sizeId] ?? LABEL_SIZES[entry.sizeId].displayName} doesn’t fit on ${DEFAULT_MIXED_SHEET.label} — choose a smaller label`,
    });
  }
  const pages = packed.pages.map((placements) =>
    blank(
      placements.flatMap((p) => {
        const c = comps.get(p.key.split('#')[0]);
        return [...(c ? translateNodes(c.nodes, p.xMm, p.yMm) : []), ...slotGuide(p.xMm, p.yMm, p.wMm, p.hMm, c ? undefined : 'Choose a design')];
      }),
    ),
  );
  return { pages, issues, filled: state.entries.length, unplaced: [] };
}
