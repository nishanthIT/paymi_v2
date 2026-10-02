/**
 * Barcode validation (spec §9). Strings are preserved exactly, including
 * leading zeroes. An invalid retail code is never silently reinterpreted as
 * an internal code — that requires an explicit owner choice.
 */

export type Symbology = 'EAN13' | 'UPCA' | 'EAN8' | 'CODE128';

export type BarcodeCheck =
  | { kind: 'empty' }
  | { kind: 'ok'; symbology: Symbology }
  | { kind: 'error'; message: string };

/** GTIN mod-10 check digit over the full code (EAN-8/UPC-A/EAN-13). */
export function hasValidGtinCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Weights alternate 3,1 starting from the digit nearest the check digit.
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

const RETAIL_BY_LENGTH: Record<number, Symbology> = { 8: 'EAN8', 12: 'UPCA', 13: 'EAN13' };

export function checkBarcode(code: string, options: { customCode?: boolean } = {}): BarcodeCheck {
  const value = code.trim();
  if (!value) return { kind: 'empty' };

  if (options.customCode) {
    // Code 128 covers printable ASCII.
    if (!/^[\x20-\x7E]{1,48}$/.test(value)) {
      return { kind: 'error', message: 'Use letters, numbers and common symbols only' };
    }
    return { kind: 'ok', symbology: 'CODE128' };
  }

  if (!/^\d+$/.test(value)) {
    return { kind: 'error', message: 'Retail barcodes are digits only — or mark this as your own code' };
  }
  const symbology = RETAIL_BY_LENGTH[value.length];
  if (!symbology) {
    return { kind: 'error', message: 'EAN-13, UPC-A and EAN-8 codes have 13, 12 or 8 digits' };
  }
  if (!hasValidGtinCheckDigit(value)) {
    return { kind: 'error', message: "The last digit doesn't match — check the code" };
  }
  return { kind: 'ok', symbology };
}

/** Heuristic for search input: looks like a scanned/typed retail barcode. */
export function looksLikeBarcode(text: string): boolean {
  return /^\d{8,14}$/.test(text.trim());
}

/**
 * For free-form "EAN-13, UPC-A, EAN-8 or your own code" fields: only text that
 * cannot be a retail code (letters/symbols, or ≤ 6 / ≥ 15 digits) counts as the
 * owner's own code. 7–14 digit strings stay retail so typos are flagged.
 */
export function inferCustomCode(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (!/^\d+$/.test(value)) return true;
  return value.length <= 6 || value.length >= 15;
}
