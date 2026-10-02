/**
 * Real barcode encoding for labels (spec §9) using the project's existing
 * jsbarcode encoders. Returns the module string ('1' = bar) including quiet
 * zones, so every output path draws the identical bar pattern.
 */
// @ts-expect-error jsbarcode ships no types for its internal encoders
import barcodesModule from 'jsbarcode/bin/barcodes';

import type { Symbology } from '../model/barcode';

const encoders = barcodesModule.default ?? barcodesModule;

const ENCODER_NAME: Record<Symbology, string> = {
  EAN13: 'EAN13',
  UPCA: 'UPC',
  EAN8: 'EAN8',
  CODE128: 'CODE128',
};

/** Quiet zones in modules [left, right] per GS1 / ISO 15417 minimums. */
const QUIET: Record<Symbology, [number, number]> = {
  EAN13: [11, 7],
  UPCA: [9, 9],
  EAN8: [7, 7],
  CODE128: [10, 10],
};

export interface EncodedBarcode {
  modules: string;
  /** Count of bar/space modules excluding quiet zones. */
  symbolModules: number;
}

export function encodeBarcode(value: string, symbology: Symbology): EncodedBarcode | null {
  try {
    const Encoder = encoders[ENCODER_NAME[symbology]];
    const encoder = new Encoder(value, { flat: true, displayValue: false });
    if (!encoder.valid()) return null;
    const result = encoder.encode();
    const data = (Array.isArray(result) ? result : [result]).map((part: { data: string }) => part.data).join('');
    const [left, right] = QUIET[symbology];
    return { modules: '0'.repeat(left) + data + '0'.repeat(right), symbolModules: data.length };
  } catch {
    return null;
  }
}
