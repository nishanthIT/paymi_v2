/** Hands one camera-scanned barcode string back to the open label editor. */
let listener: ((barcode: string) => void) | null = null;

export function subscribeLabelScan(callback: (barcode: string) => void) {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitLabelScan(barcode: string) {
  listener?.(barcode);
}
