/**
 * Shelf-labels draft settings (stored in LabelDraft.settings) and the bridge
 * from a LabelItem to renderer content. Pricing always goes through
 * parseMoneyText, so a blank price stays "not entered" all the way to output.
 */
import type { LabelItem } from '../model/label-item';
import { checkBarcode } from '../model/barcode';
import { parseMoneyText } from '../model/money';
import type { ShelfDesign, ShelfLabelContent } from './shelf-label';

export type ShelfMode = 'standard' | 'promo';

export interface ShelfSettings {
  sheetId: 'STANDARD_SHELF_21';
  design: ShelfDesign;
  penceSameSize: boolean;
  printDate: boolean;
  priceOnRight: boolean;
  barcodeDownSide: boolean;
  startAt: number;
  widthRatio: number;
  colouredStock: boolean;
}

export const WIDTH_STEPS = [0.6, 0.64, 0.67, 0.71, 0.75, 0.78, 0.82, 0.85, 0.89, 0.93, 0.96, 1];

export function defaultShelfSettings(mode: ShelfMode): ShelfSettings {
  return {
    sheetId: 'STANDARD_SHELF_21',
    design: mode === 'promo' ? 'half_yellow' : 'standard',
    penceSameSize: false,
    printDate: false,
    priceOnRight: true,
    barcodeDownSide: false,
    startAt: 1,
    widthRatio: 1,
    colouredStock: false,
  };
}

export function readShelfSettings(mode: ShelfMode, stored: Record<string, unknown>): ShelfSettings {
  const defaults = defaultShelfSettings(mode);
  const merged = { ...defaults, ...(stored as Partial<ShelfSettings>) };
  const allowed: ShelfDesign[] = mode === 'promo' ? ['full_yellow', 'half_yellow'] : ['standard', 'tobacco'];
  if (!allowed.includes(merged.design)) merged.design = defaults.design;
  if (!WIDTH_STEPS.includes(merged.widthRatio)) merged.widthRatio = 1;
  return merged;
}

export function itemToShelfContent(item: LabelItem): ShelfLabelContent {
  const snap = item.snapshot;
  const price = parseMoneyText(item.priceText);
  const was = parseMoneyText(item.wasText);
  const total = parseMoneyText(item.offerTotalText);
  const qty = Number(item.offerQuantityText);
  const code = checkBarcode(snap.barcode, { customCode: snap.customCode });
  return {
    brand: snap.brand,
    name: snap.displayName,
    packSize: snap.packSize,
    barcode: code.kind === 'ok' ? snap.barcode : undefined,
    symbology: code.kind === 'ok' ? code.symbology : undefined,
    priceMinor: price.kind === 'ok' && price.minor > 0 ? price.minor : undefined,
    wasMinor: was.kind === 'ok' && was.minor > 0 ? was.minor : undefined,
    offer:
      Number.isInteger(qty) && qty >= 2 && total.kind === 'ok' && total.minor > 0
        ? { quantity: qty, totalMinor: total.minor }
        : undefined,
  };
}

/** One date string per job, in the device's local zone (shop timezone setting doesn't exist yet). */
export function formatJobDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}
