/** Page composition for output jobs (pure): grid sheets and talker sheets, always true size. */
import { LABEL_SIZES } from '../registry/sizes';
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import { packCustom, translateNodes } from './mixed-sheet';
import { cellRect, cellsPerSheet, type GridSheet, type SheetPage } from './sheet-layout';

/** Standard shelf-edge sheets: each instance in its physical cell; unused cells get nothing. */
export function composeGridPages(pages: SheetPage[], compositionFor: (itemId: string) => LabelComposition | null, sheet: GridSheet): LabelComposition[] {
  return pages.map((page) => {
    const nodes: CompositionNode[] = [];
    page.forEach((inst, i) => {
      if (!inst) return;
      const c = compositionFor(inst.itemId);
      if (!c) throw new Error('A label on this sheet has no artwork');
      const r = cellRect(sheet, i + 1);
      nodes.push(...translateNodes(c.nodes, r.xMm, r.yMm));
    });
    return { widthMm: sheet.page.widthMm, heightMm: sheet.page.heightMm, nodes, warnings: [] };
  });
}

/** Cell after the last one used on the final sheet (wraps to 1 on a full sheet). */
export function nextStartCell(pages: SheetPage[], sheet: GridSheet): number {
  const last = pages[pages.length - 1] ?? [];
  let used = 0;
  last.forEach((inst, i) => {
    if (inst) used = i + 1;
  });
  return used >= cellsPerSheet(sheet) || used === 0 ? 1 : used + 1;
}

/**
 * Talker/poster output. A4 designs are one page per copy; smaller cards are
 * packed at true size onto A4 portrait sheets (never scaled).
 */
export function composeTemplatePages(c: LabelComposition, copies: number): LabelComposition[] {
  const a4 = [LABEL_SIZES.A4_PORTRAIT, LABEL_SIZES.A4_LANDSCAPE].some((p) => p.widthMm === c.widthMm && p.heightMm === c.heightMm);
  if (a4) return Array.from({ length: copies }, () => c);
  const page = LABEL_SIZES.A4_PORTRAIT;
  const packed = packCustom(Array.from({ length: copies }, (_, k) => ({ key: String(k), wMm: c.widthMm, hMm: c.heightMm })), page);
  if (packed.unfit.length) throw new Error(`This design (${c.widthMm} × ${c.heightMm} mm) doesn’t fit on A4`);
  return packed.pages.map((placements) => ({
    widthMm: page.widthMm,
    heightMm: page.heightMm,
    nodes: placements.flatMap((p) => translateNodes(c.nodes, p.xMm, p.yMm)),
    warnings: [],
  }));
}
