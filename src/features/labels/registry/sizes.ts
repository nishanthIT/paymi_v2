/**
 * Physical-size registry — the source of truth for label/page geometry (spec §9).
 * Catalogue display rounds inch-based sizes; exports must use the exact values.
 */
export interface PhysicalSize {
  id: string;
  widthMm: number;
  heightMm: number;
  /** Rounded catalogue text, e.g. "203 × 76 mm" for the 8 × 3 in family. */
  displayName: string;
}

export const LABEL_SIZES = {
  SEL_CELL: { id: 'SEL_CELL', widthMm: 70, heightMm: 38, displayName: '70 × 38 mm' },
  SHELF_GB: { id: 'SHELF_GB', widthMm: 203, heightMm: 75, displayName: '203 × 75 mm' },
  ALCOHOL_SQUARE: { id: 'ALCOHOL_SQUARE', widthMm: 70, heightMm: 70, displayName: '70 × 70 mm' },
  SHELF_8X3: { id: 'SHELF_8X3', widthMm: 203.2, heightMm: 76.2, displayName: '203 × 76 mm' },
  SHELF_6X3: { id: 'SHELF_6X3', widthMm: 152.4, heightMm: 76.2, displayName: '152 × 76 mm' },
  SHELF_4X3: { id: 'SHELF_4X3', widthMm: 101.6, heightMm: 76.2, displayName: '102 × 76 mm' },
  A4_PORTRAIT: { id: 'A4_PORTRAIT', widthMm: 210, heightMm: 297, displayName: 'A4 portrait' },
  A4_LANDSCAPE: { id: 'A4_LANDSCAPE', widthMm: 297, heightMm: 210, displayName: 'A4 landscape' },
  REDUCED_50X30: { id: 'REDUCED_50X30', widthMm: 50, heightMm: 30, displayName: '50 × 30 mm' },
  REDUCED_50X25: { id: 'REDUCED_50X25', widthMm: 50, heightMm: 25, displayName: '50 × 25 mm' },
  REDUCED_40X30: { id: 'REDUCED_40X30', widthMm: 40, heightMm: 30, displayName: '40 × 30 mm' },
  REDUCED_30X50: { id: 'REDUCED_30X50', widthMm: 30, heightMm: 50, displayName: '30 × 50 mm' },
} as const satisfies Record<string, PhysicalSize>;

export type LabelSizeId = keyof typeof LABEL_SIZES;

/** Standard shelf-edge sheet: A4 portrait, 3 × 7 = 21 cells of 70 × 38 mm, no gutters. */
export const STANDARD_SHELF_SHEET = {
  id: 'STANDARD_SHELF_21',
  title: 'Standard shelf-edge 21',
  subtitle: 'A4 · 3 × 7 · 21 labels · 70 × 38 mm each',
  page: LABEL_SIZES.A4_PORTRAIT,
  cell: LABEL_SIZES.SEL_CELL,
  columns: 3,
  rows: 7,
  gutterXMm: 0,
  gutterYMm: 0,
  // 297 - 7×38 = 31 → 15.5 top/bottom when vertically centred (spec §5)
  marginTopMm: 15.5,
  marginLeftMm: 0,
} as const;

export const mmToPt = (mm: number): number => (mm * 72) / 25.4;
export const mmToDots = (mm: number, printerDpi: number): number =>
  Math.round((mm * printerDpi) / 25.4);
