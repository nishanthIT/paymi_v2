import type { ReportProduct } from './types';

/**
 * Tiny in-memory bridge that lets the shared barcode scanner hand a scanned
 * product back to the wrong-price report screen (which stays mounted below
 * the fullscreen scanner modal).
 */
let listener: ((product: ReportProduct) => void) | null = null;

export function subscribeReportScan(callback: (product: ReportProduct) => void) {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitReportScan(product: ReportProduct) {
  listener?.(product);
}
