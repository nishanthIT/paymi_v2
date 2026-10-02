/**
 * Stable template/layout/tool manifest (spec §3, §7, §8).
 * IDs are permanent; artwork renderers attach to these IDs in later batches.
 */
import type { LabelSizeId } from './sizes';

// ---------- Entry tools (Labels landing, exact order) ----------

export type LabelToolId =
  | 'SEL_STANDARD'
  | 'SEL_PROMO'
  | 'REDUCED_STICKER'
  | 'SHELF_TALKER'
  | 'SHELF_RUNNER'
  | 'MIXED_SHEET';

export interface LabelTool {
  id: LabelToolId;
  title: string;
  /** Exact visible description from the reference landing screen. */
  description: string;
  route: string;
}

export const LABEL_TOOLS: LabelTool[] = [
  {
    id: 'SEL_STANDARD',
    title: 'SEL · Standard',
    description: 'Shelf edge label — name, price and barcode',
    route: '/(app)/labels/shelf?mode=standard',
  },
  {
    id: 'SEL_PROMO',
    title: 'SEL · Promo',
    description: 'Shelf edge label for an offer — yellow stock or printed',
    route: '/(app)/labels/shelf?mode=promo',
  },
  {
    id: 'REDUCED_STICKER',
    title: 'Reduced sticker',
    description: 'Markdown sticker that goes on the item itself',
    route: '/(app)/labels/reduced',
  },
  {
    id: 'SHELF_TALKER',
    title: 'Shelf talker',
    description: 'Card that sticks out from the shelf edge',
    route: '/(app)/labels/templates',
  },
  {
    id: 'SHELF_RUNNER',
    title: 'Shelf liner / Shelf runner',
    description: 'Long strip along the shelf edge — your message, no product',
    route: '/(app)/labels/runner',
  },
  {
    id: 'MIXED_SHEET',
    title: 'Mixed size label',
    description: 'Different sizes together on one page',
    route: '/(app)/labels/mixed',
  },
];

// ---------- Catalogue templates T01–T29 (spec §7) ----------

export type TemplateOrientation = 'portrait' | 'landscape';

export interface TemplateDefinition {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  sizeId: LabelSizeId;
  orientation: TemplateOrientation;
  productSlots: 1 | 2 | 3;
  /** Twin-photo hero designs repeat one product's photo twice. */
  twinPhotoSharedProduct?: boolean;
  markets: string[]; // regional filtering; 'GB' is the reference state
  showsBarcode: boolean;
}

const S = {
  SHELF_GB: 'Shelf label · 203 × 75 mm',
  ALCOHOL: 'Alcohol · 7 × 7 cm',
  SHELF_8: 'Shelf · 8 × 3 in',
  SHELF_6: 'Shelf · 6 × 3 in',
  SHELF_4: 'Shelf · 4 × 3 in',
  A4: 'A4',
} as const;

const t = (
  id: string,
  title: string,
  subtitle: string,
  section: string,
  sizeId: LabelSizeId,
  orientation: TemplateOrientation = 'landscape',
  productSlots: 1 | 2 | 3 = 1,
  extra: Partial<TemplateDefinition> = {},
): TemplateDefinition => ({
  id,
  title,
  subtitle,
  section,
  sizeId,
  orientation,
  productSlots,
  markets: ['GB'],
  showsBarcode: false,
  ...extra,
});

/** Exact catalogue order. Titles/subtitles are reference text — do not edit casually. */
export const TEMPLATES: TemplateDefinition[] = [
  t('T01', 'WOW Red · Shelf', '203 × 75 mm · WOW badge + price + product photo', S.SHELF_GB, 'SHELF_GB'),
  t('T02', 'Special Offer · Shelf', '203 × 75 mm · Red banner + bold price + photo', S.SHELF_GB, 'SHELF_GB'),
  t('T03', 'Limited Time · Shelf', '203 × 75 mm · Yellow background · image right, text left', S.SHELF_GB, 'SHELF_GB'),
  t('T04', 'Black Label · 7 × 7 cm', '70 × 70 mm · Bold underlined name + big red £', S.ALCOHOL, 'ALCOHOL_SQUARE', 'portrait'),
  t('T05', 'WOW · 7 × 7 cm', '70 × 70 mm · Red WOW disc with price + product caption', S.ALCOHOL, 'ALCOHOL_SQUARE', 'portrait'),
  t('T06', 'Was / Now · 7 × 7 cm', '70 × 70 mm · Was → Now', S.ALCOHOL, 'ALCOHOL_SQUARE', 'portrait'),
  t('T07', 'Multi-buy · 7 × 7 cm', '70 × 70 mm · Yellow · "X for £Y" + product list', S.ALCOHOL, 'ALCOHOL_SQUARE', 'portrait'),
  t('T08', 'Side Panel · 8 × 3 in', '203 × 76 mm · Product left · red offer panel right', S.SHELF_8, 'SHELF_8X3'),
  t('T09', 'WOW · 8 × 3 in', '203 × 76 mm · WOW circle + name + photo', S.SHELF_8, 'SHELF_8X3'),
  t('T10', 'Was / Now · 8 × 3 in', '203 × 76 mm · Big strikethrough was → now', S.SHELF_8, 'SHELF_8X3'),
  t('T11', 'Multi-buy · 8 × 3 in', '203 × 76 mm · Yellow · "X for £Y" + photo + product list', S.SHELF_8, 'SHELF_8X3'),
  t('T12', 'Red Banner · 6 × 3 in', '152 × 76 mm · "X for £Y" banner + each-price', S.SHELF_6, 'SHELF_6X3'),
  t('T13', 'WOW · 6 × 3 in', '152 × 76 mm · WOW circle + price + product', S.SHELF_6, 'SHELF_6X3'),
  t('T14', 'Was / Now · 6 × 3 in', '152 × 76 mm · Big strikethrough "was" → "now"', S.SHELF_6, 'SHELF_6X3'),
  t('T15', 'Multi-buy · 6 × 3 in', '152 × 76 mm · Yellow · "X for £Y" + product list', S.SHELF_6, 'SHELF_6X3'),
  t('T16', 'Circle Badge · 4 × 3 in', '102 × 76 mm · Big red circle + product line', S.SHELF_4, 'SHELF_4X3'),
  t('T17', 'WOW · 4 × 3 in', '102 × 76 mm · WOW circle on left · name + price right', S.SHELF_4, 'SHELF_4X3'),
  t('T18', 'Was / Now · 4 × 3 in', '102 × 76 mm · Compact was → now', S.SHELF_4, 'SHELF_4X3'),
  t('T19', 'Multi-buy · 4 × 3 in', '102 × 76 mm · Yellow · "X for £Y" headline', S.SHELF_4, 'SHELF_4X3'),
  t('T20', 'Hero Poster · A4', 'Full-page A4 · banner + massive price + product hero', S.A4, 'A4_PORTRAIT', 'portrait'),
  t('T21', 'Triptych · A4', 'A4 · 3 products stacked · price circle + image', S.A4, 'A4_PORTRAIT', 'portrait', 3),
  t('T22', 'Simple Trio · A4', 'A4 · 3 products side-by-side · one price under each', S.A4, 'A4_PORTRAIT', 'portrait', 3),
  t('T23', 'Stacked Duo · A4', 'A4 portrait · 2 products stacked top/bottom', S.A4, 'A4_PORTRAIT', 'portrait', 2),
  t('T24', 'Hero Landscape · A4', 'A4 landscape · image left, price + name right', S.A4, 'A4_LANDSCAPE'),
  t('T25', 'Duo Landscape · A4', 'A4 landscape · 2 products side-by-side', S.A4, 'A4_LANDSCAPE', 'landscape', 2),
  t('T26', 'Strip Landscape · A4', 'A4 landscape · 3 products in one row', S.A4, 'A4_LANDSCAPE', 'landscape', 3),
  t('T27', 'Ribbon Hero · Landscape', 'A4 landscape · red ribbon · twin product photos · italic ONLY £X.XX', S.A4, 'A4_LANDSCAPE', 'landscape', 1, { twinPhotoSharedProduct: true }),
  t('T28', 'Bold Title · Landscape', 'A4 landscape · red ribbon · huge red title · twin photos + price', S.A4, 'A4_LANDSCAPE', 'landscape', 1, { twinPhotoSharedProduct: true }),
  t('T29', 'Price Hero · Landscape', 'A4 landscape · minimal · huge price above, large product photo below', S.A4, 'A4_LANDSCAPE'),
];

// ---------- Mixed-sheet layouts M00–M07 (spec §8) ----------

export interface MixedLayoutCell {
  sizeId: LabelSizeId;
}

export interface MixedLayoutDefinition {
  id: string;
  title: string;
  description: string;
  cells: MixedLayoutCell[]; // empty for Custom
  isCustom?: boolean;
}

const cellRun = (sizeId: LabelSizeId, count: number): MixedLayoutCell[] =>
  Array.from({ length: count }, () => ({ sizeId }));

export const MIXED_LAYOUTS: MixedLayoutDefinition[] = [
  {
    id: 'M00',
    title: 'Custom',
    description: 'None of these - build your own. Add labels one at a time, any size, auto-arranged.',
    cells: [],
    isCustom: true,
  },
  { id: 'M01', title: '3 × 8 × 3 in', description: 'Three full-width shelf labels stacked', cells: cellRun('SHELF_8X3', 3) },
  { id: 'M02', title: '3 × 6 × 3 in', description: 'Three medium shelf labels stacked, centred', cells: cellRun('SHELF_6X3', 3) },
  { id: 'M03', title: '6 × 4 × 3 in', description: 'Two columns × three rows of compact labels', cells: cellRun('SHELF_4X3', 6) },
  {
    id: 'M04',
    title: 'Mixed shelf (8×3 + 6×3 + 4×3)',
    description: 'One of each shelf size, stacked',
    cells: [{ sizeId: 'SHELF_8X3' }, { sizeId: 'SHELF_6X3' }, { sizeId: 'SHELF_4X3' }],
  },
  {
    id: 'M05',
    title: '1 × 8×3 + 4 × 4×3',
    description: 'Hero shelf label on top, four compact labels in 2×2 below',
    cells: [{ sizeId: 'SHELF_8X3' }, ...cellRun('SHELF_4X3', 4)],
  },
  { id: 'M06', title: '6 × 7 × 7 cm (alcohol)', description: 'Two columns × three rows of square alcohol tags', cells: cellRun('ALCOHOL_SQUARE', 6) },
  {
    id: 'M07',
    title: '4 × 7 × 7 cm + 1 × 6 × 3',
    description: 'Four square alcohol tags + one shelf label below',
    cells: [...cellRun('ALCOHOL_SQUARE', 4), { sizeId: 'SHELF_6X3' }],
  },
];
