/**
 * In-memory bridge that hands a scanned product from the shared barcode
 * scanner back to the waste form (same pattern as the price-report bridge).
 */
export interface WasteScanProduct {
  id: string;
  title: string;
  barcode?: string | null;
  price?: number | null;
}

let listener: ((product: WasteScanProduct) => void) | null = null;

export function subscribeWasteScan(callback: (product: WasteScanProduct) => void) {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitWasteScan(product: WasteScanProduct) {
  listener?.(product);
}
