/**
 * Mixed-sheet geometry (spec §8). Cell positions are explicit mm on the print
 * sheet, calibrated to the R02/R03 schematics (which show topology, not
 * measured margins). Every cell keeps its exact physical size.
 */
import { MIXED_LAYOUTS } from './manifest';
import { LABEL_SIZES, type LabelSizeId, type PhysicalSize } from './sizes';

export interface CellRect {
  sizeId: LabelSizeId;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export interface MixedSheet {
  id: string;
  label: string;
  page: PhysicalSize;
}

/** Only configured stock is offered; A4 portrait is the reference sheet. */
export const MIXED_SHEETS: MixedSheet[] = [{ id: 'A4_PORTRAIT', label: 'A4 · portrait', page: LABEL_SIZES.A4_PORTRAIT }];
export const DEFAULT_MIXED_SHEET = MIXED_SHEETS[0];

/** Size subtitles used on slot rows ("Shelf · 6 × 3 in"), matching catalogue sections. */
export const SIZE_LABEL: Partial<Record<LabelSizeId, string>> = {
  SHELF_8X3: 'Shelf · 8 × 3 in',
  SHELF_6X3: 'Shelf · 6 × 3 in',
  SHELF_4X3: 'Shelf · 4 × 3 in',
  ALCOHOL_SQUARE: 'Alcohol · 7 × 7 cm',
  SHELF_GB: 'Shelf label · 203 × 75 mm',
};

/** Sizes a Custom sheet can hold: every template size that fits on A4 portrait. */
export const CUSTOM_SIZES: LabelSizeId[] = ['SHELF_8X3', 'SHELF_6X3', 'SHELF_4X3', 'ALCOHOL_SQUARE', 'SHELF_GB'];

// Calibration (assumptions, from ~151 px schematic pages ≈ 297 mm):
// shelf rows start 16 mm down with 8 mm between rows; square rows start 24 mm
// down; two 4 in columns use 2.4 mm margins + 2 mm gap (203.2 + 6.8 = 210).
const PAGE_W = LABEL_SIZES.A4_PORTRAIT.widthMm;
const ROW_H = LABEL_SIZES.SHELF_8X3.heightMm;
const TOP = 16;
const GAP_Y = 8;
const rowY = (i: number) => TOP + i * (ROW_H + GAP_Y);
const COL_X = [2.4, 2.4 + LABEL_SIZES.SHELF_4X3.widthMm + 2];
const SQ = LABEL_SIZES.ALCOHOL_SQUARE.widthMm;
const SQ_X = [(PAGE_W - SQ * 2 - 8) / 2, (PAGE_W - SQ * 2 - 8) / 2 + SQ + 8];
const sqY = (i: number) => 24 + i * (SQ + 8);

function cell(sizeId: LabelSizeId, xMm: number | 'centre', yMm: number): CellRect {
  const { widthMm: wMm, heightMm: hMm } = LABEL_SIZES[sizeId];
  return { sizeId, xMm: xMm === 'centre' ? (PAGE_W - wMm) / 2 : xMm, yMm, wMm, hMm };
}

export const MIXED_CELLS: Record<string, CellRect[]> = {
  M00: [],
  M01: [0, 1, 2].map((r) => cell('SHELF_8X3', 'centre', rowY(r))),
  M02: [0, 1, 2].map((r) => cell('SHELF_6X3', 'centre', rowY(r))),
  M03: [0, 1, 2].flatMap((r) => COL_X.map((x) => cell('SHELF_4X3', x, rowY(r)))),
  M04: [cell('SHELF_8X3', 'centre', rowY(0)), cell('SHELF_6X3', 'centre', rowY(1)), cell('SHELF_4X3', 'centre', rowY(2))],
  M05: [cell('SHELF_8X3', 'centre', rowY(0)), ...[1, 2].flatMap((r) => COL_X.map((x) => cell('SHELF_4X3', x, rowY(r))))],
  M06: [0, 1, 2].flatMap((r) => SQ_X.map((x) => cell('ALCOHOL_SQUARE', x, sqY(r)))),
  // R02 shows a wider gap above the shelf label: 22 mm below the squares.
  M07: [...[0, 1].flatMap((r) => SQ_X.map((x) => cell('ALCOHOL_SQUARE', x, sqY(r)))), cell('SHELF_6X3', 'centre', sqY(2) - 8 + 22)],
};

/** Custom packing spacing (assumption): same side margin/gap as the 4 in columns. */
export const CUSTOM_SPACING = { marginXMm: 2.4, marginYMm: 10, gapXMm: 2, gapYMm: 6 };

export function mixedLayout(id: string) {
  return MIXED_LAYOUTS.find((l) => l.id === id);
}
