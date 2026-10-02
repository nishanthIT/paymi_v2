/**
 * Label item model — the RRP / manual-price rules from spec §1 live here and
 * nowhere else, so every editor and output path applies them identically.
 */
import { checkBarcode, type Symbology } from './barcode';
import { catalogueRrpToMinor, formatMinor, parseMoneyText } from './money';

export type LookupStatus = 'idle' | 'looking_up' | 'found' | 'not_found' | 'error';

/** Label-specific snapshot — editing it never touches the global catalogue. */
export interface LabelProductSnapshot {
  catalogueProductId?: string;
  /** Exact scanned/typed string, leading zeroes kept. */
  barcode: string;
  barcodeSymbology?: Symbology;
  /** Owner explicitly chose a non-retail (Code 128) code. */
  customCode?: boolean;
  displayName: string;
  brand: string;
  packSize: string;
  imageUri?: string;
  /** Catalogue RRP as captured at lookup, kept apart from the final price. */
  sourceRrpMinor?: number;
  sourceRrpCurrency?: 'GBP';
}

export interface LabelItem {
  id: string;
  createdAt: number;
  lookup: LookupStatus;
  lookupError?: string;
  snapshot: LabelProductSnapshot;
  /** Final selling price as typed; blank = not entered (never printed as £0.00). */
  priceText: string;
  /** True once the owner types in Price — later lookups/RRP must not overwrite it. */
  priceEdited: boolean;
  /** Owner-entered RRP (user-provided, not a verified manufacturer value). */
  rrpText: string;
  /** Separately confirmed previous selling price — never derived from RRP. */
  wasText: string;
  offerQuantityText: string;
  offerTotalText: string;
  copies: number;
}

export interface CatalogueLookupResult {
  id: string;
  title: string;
  barcode?: string | null;
  retailSize?: string | null;
  rrp?: unknown;
  imageUri?: string | null;
}

let idCounter = 0;
export function newItemId(): string {
  idCounter += 1;
  return `li_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createPendingItem(barcode: string, now = Date.now()): LabelItem {
  return {
    id: newItemId(),
    createdAt: now,
    lookup: 'looking_up',
    snapshot: { barcode, displayName: '', brand: '', packSize: '' },
    priceText: '',
    priceEdited: false,
    rrpText: '',
    wasText: '',
    offerQuantityText: '',
    offerTotalText: '',
    copies: 1,
  };
}

export function createCustomItem(barcode = '', now = Date.now()): LabelItem {
  return { ...createPendingItem(barcode, now), lookup: 'idle' };
}

/**
 * Apply a catalogue lookup. Owner edits always win: an edited Price is kept,
 * and non-empty edited name/pack text is not replaced by the refresh.
 */
export function applyLookupResult(item: LabelItem, result: CatalogueLookupResult | null): LabelItem {
  if (!result) {
    return { ...item, lookup: 'not_found', lookupError: undefined };
  }
  // The catalogue has no currency column; it is the UK catalogue, so RRP is GBP.
  const sourceRrpMinor = catalogueRrpToMinor(result.rrp) ?? undefined;
  const checked = checkBarcode(item.snapshot.barcode);
  const snapshot: LabelProductSnapshot = {
    ...item.snapshot,
    catalogueProductId: result.id,
    barcodeSymbology: checked.kind === 'ok' ? checked.symbology : item.snapshot.barcodeSymbology,
    displayName: item.snapshot.displayName || result.title,
    packSize: item.snapshot.packSize || (result.retailSize ?? '').trim(),
    imageUri: item.snapshot.imageUri ?? result.imageUri ?? undefined,
    sourceRrpMinor,
    sourceRrpCurrency: sourceRrpMinor != null ? 'GBP' : undefined,
  };
  const priceText =
    !item.priceEdited && sourceRrpMinor != null ? formatMinor(sourceRrpMinor) : item.priceText;
  return { ...item, lookup: 'found', lookupError: undefined, snapshot, priceText };
}

export function applyLookupError(item: LabelItem, message: string): LabelItem {
  return { ...item, lookup: 'error', lookupError: message };
}

/** Owner typed in Price: it becomes the final label price and is locked from refreshes. */
export function setPriceText(item: LabelItem, text: string): LabelItem {
  return { ...item, priceText: text, priceEdited: true };
}

/** Owner-entered RRP may prefill Price only while Price is untouched. */
export function setRrpText(item: LabelItem, text: string): LabelItem {
  if (item.priceEdited) return { ...item, rrpText: text };
  const parsed = parseMoneyText(text);
  const priceText = parsed.kind === 'ok' ? formatMinor(parsed.minor) : item.priceText;
  return { ...item, rrpText: text, priceText };
}

export type PriceSource = 'owner' | 'catalogue_rrp' | 'owner_rrp' | 'missing';

export function priceSource(item: LabelItem): PriceSource {
  if (!item.priceText.trim()) return 'missing';
  if (item.priceEdited) return 'owner';
  if (item.rrpText.trim()) return 'owner_rrp';
  return 'catalogue_rrp';
}

export interface ItemErrors {
  displayName?: string;
  barcode?: string;
  price?: string;
  rrp?: string;
  was?: string;
  offer?: string;
  copies?: string;
}

/** Field-level validation used to block output of an incomplete price-bearing item. */
export function validateItem(item: LabelItem): ItemErrors {
  const errors: ItemErrors = {};
  if (!item.snapshot.displayName.trim()) errors.displayName = 'Add a product name';

  const barcode = checkBarcode(item.snapshot.barcode, { customCode: item.snapshot.customCode });
  if (barcode.kind === 'error') errors.barcode = barcode.message;

  const price = parseMoneyText(item.priceText);
  if (price.kind === 'empty') errors.price = 'Enter the price for this label';
  else if (price.kind === 'error') errors.price = price.message;
  else if (price.minor <= 0) errors.price = 'Price must be more than £0.00';

  const rrp = parseMoneyText(item.rrpText);
  if (rrp.kind === 'error') errors.rrp = rrp.message;

  const was = parseMoneyText(item.wasText);
  if (was.kind === 'error') errors.was = was.message;

  const hasQty = item.offerQuantityText.trim() !== '';
  const hasTotal = item.offerTotalText.trim() !== '';
  if (hasQty || hasTotal) {
    const qty = Number(item.offerQuantityText);
    const total = parseMoneyText(item.offerTotalText);
    if (!Number.isInteger(qty) || qty < 2) errors.offer = 'Offer quantity must be 2 or more';
    else if (total.kind !== 'ok' || total.minor <= 0) errors.offer = 'Enter the offer total, e.g. 16.00';
  }

  if (!Number.isInteger(item.copies) || item.copies < 1) errors.copies = 'Copies must be 1 or more';
  return errors;
}

export function isOutputReady(item: LabelItem): boolean {
  return item.lookup !== 'looking_up' && Object.keys(validateItem(item)).length === 0;
}

export function needsPrice(item: LabelItem): boolean {
  return item.lookup !== 'looking_up' && parseMoneyText(item.priceText).kind !== 'ok';
}
