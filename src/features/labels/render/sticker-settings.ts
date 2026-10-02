/**
 * Reduced-sticker settings (stored in LabelDraft.settings) and item bridging.
 * Physical size is the source of truth; dots are derived from printer dpi.
 */
import { checkBarcode } from '../model/barcode';
import type { LabelItem } from '../model/label-item';
import { parseMoneyText } from '../model/money';
import { mmToDots } from '../registry/sizes';
import type { StickerBackground, StickerContent, StickerDesign, StickerTextColour } from './reduced-sticker';

export interface StickerSizePreset {
  id: 'REDUCED_50X30' | 'REDUCED_50X25' | 'REDUCED_40X30' | 'REDUCED_30X50';
  widthMm: number;
  heightMm: number;
  /** Reference wording before the dots text ("Most common", "Portrait"). */
  note?: string;
}

export const STICKER_PRESETS: StickerSizePreset[] = [
  { id: 'REDUCED_50X30', widthMm: 50, heightMm: 30, note: 'Most common' },
  { id: 'REDUCED_50X25', widthMm: 50, heightMm: 25 },
  { id: 'REDUCED_40X30', widthMm: 40, heightMm: 30 },
  { id: 'REDUCED_30X50', widthMm: 30, heightMm: 50, note: 'Portrait' },
];

/** Custom-size bounds: typical 2–4 in thermal roll printers (≤ 104 mm print width). */
export const CUSTOM_BOUNDS = { minW: 20, maxW: 104, minH: 15, maxH: 150 };

/** Resolution used for the dots readout until a real printer profile supplies one. */
export const DEFAULT_DPI = 203;

export interface StickerSettings {
  design: StickerDesign;
  background: StickerBackground;
  textColour: StickerTextColour;
  sizeId: StickerSizePreset['id'] | 'CUSTOM';
  widthMm: number;
  heightMm: number;
  printDate: boolean;
  title: string;
  currency: 'GBP';
  printerDpi: number;
}

export function defaultStickerSettings(): StickerSettings {
  return {
    design: 'reduced',
    background: 'none',
    textColour: 'black',
    sizeId: 'REDUCED_50X30',
    widthMm: 50,
    heightMm: 30,
    printDate: false,
    title: 'REDUCED',
    currency: 'GBP',
    printerDpi: DEFAULT_DPI,
  };
}

export function readStickerSettings(stored: Record<string, unknown>): StickerSettings {
  const merged = { ...defaultStickerSettings(), ...(stored as Partial<StickerSettings>) };
  if (!['reduced', 'was_now', 'price'].includes(merged.design)) merged.design = 'reduced';
  if (!['none', 'white', 'yellow', 'red'].includes(merged.background)) merged.background = 'none';
  if (!['black', 'red'].includes(merged.textColour)) merged.textColour = 'black';
  const preset = STICKER_PRESETS.find((p) => p.id === merged.sizeId);
  if (preset) {
    merged.widthMm = preset.widthMm;
    merged.heightMm = preset.heightMm;
  } else if (validateCustomSize(merged.widthMm, merged.heightMm)) {
    Object.assign(merged, { sizeId: 'REDUCED_50X30', widthMm: 50, heightMm: 30 });
  }
  return merged;
}

export function dotsText(widthMm: number, heightMm: number, dpi: number) {
  return `${mmToDots(widthMm, dpi)} × ${mmToDots(heightMm, dpi)} dots at ${dpi} dpi`;
}

export function sizeTitle(widthMm: number, heightMm: number) {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(widthMm)} × ${fmt(heightMm)} mm`;
}

/** Returns an error message, or null when the custom size is usable. */
export function validateCustomSize(widthMm: number, heightMm: number): string | null {
  const { minW, maxW, minH, maxH } = CUSTOM_BOUNDS;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return 'Enter a width and height in mm';
  if (widthMm < minW || widthMm > maxW) return `Width must be ${minW}–${maxW} mm`;
  if (heightMm < minH || heightMm > maxH) return `Height must be ${minH}–${maxH} mm`;
  return null;
}

export function itemToStickerContent(item: LabelItem | undefined, title: string): StickerContent {
  if (!item) return { title };
  const code = checkBarcode(item.snapshot.barcode, { customCode: item.snapshot.customCode });
  const price = parseMoneyText(item.priceText);
  const was = parseMoneyText(item.wasText);
  return {
    title,
    productName: item.snapshot.displayName || undefined,
    barcode: code.kind === 'ok' ? item.snapshot.barcode : undefined,
    symbology: code.kind === 'ok' ? code.symbology : undefined,
    priceMinor: price.kind === 'ok' && price.minor > 0 ? price.minor : undefined,
    wasMinor: was.kind === 'ok' && was.minor > 0 ? was.minor : undefined,
  };
}

export interface StickerErrors {
  price?: string;
  was?: string;
  barcode?: string;
  copies?: string;
}

/** Print is allowed only when this returns no errors (spec §6 "Add a price to print."). */
export function validateSticker(item: LabelItem | undefined): StickerErrors {
  const errors: StickerErrors = {};
  const price = parseMoneyText(item?.priceText ?? '');
  if (price.kind === 'empty') errors.price = 'Add a price to print.';
  else if (price.kind === 'error') errors.price = price.message;
  else if (price.minor <= 0) errors.price = 'Price must be more than £0.00';
  if (item) {
    const was = parseMoneyText(item.wasText);
    if (was.kind === 'error') errors.was = was.message;
    const code = checkBarcode(item.snapshot.barcode, { customCode: item.snapshot.customCode });
    if (code.kind === 'error') errors.barcode = code.message;
    if (!Number.isInteger(item.copies) || item.copies < 1) errors.copies = 'Copies must be a whole number, 1 or more';
  }
  return errors;
}
