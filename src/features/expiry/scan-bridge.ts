import type { ExpirySearchProduct } from './api';

/** Hands a scanned product from the shared barcode scanner back to Manage Expiry. */
let listener: ((product: ExpirySearchProduct) => void) | null = null;

export function subscribeExpiryScan(callback: (product: ExpirySearchProduct) => void) {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitExpiryScan(product: ExpirySearchProduct) {
  listener?.(product);
}
