/**
 * Headless barcode → SVG for print. Uses jsbarcode's encoders directly
 * (same technique as react-native-barcode-builder) so no DOM/canvas is
 * needed — the binary string is turned into <rect> bars ourselves.
 */
// @ts-expect-error jsbarcode ships no types for its internal encoders
import barcodesModule from 'jsbarcode/bin/barcodes';

const barcodes = barcodesModule.default ?? barcodesModule;

interface EncodeResult {
  data: string;
  text?: string;
}

function runEncoder(value: string, format: 'EAN13' | 'CODE128'): string | null {
  try {
    const Encoder = barcodes[format];
    const encoder = new Encoder(value, {
      width: 2,
      height: 100,
      flat: true, // EAN: single flat binary string instead of guard segments
      displayValue: false,
      fontSize: 0,
      textMargin: 0,
    });
    if (!encoder.valid()) return null;
    const encoded: EncodeResult | EncodeResult[] = encoder.encode();
    const parts = Array.isArray(encoded) ? encoded : [encoded];
    return parts.map((p) => p.data).join('');
  } catch {
    return null;
  }
}

/** Binary '1010…' string for a value, auto-picking EAN-13 with CODE128 fallback. */
function encodeBinary(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{12,13}$/.test(value)) {
    const ean = runEncoder(value, 'EAN13');
    if (ean) return ean;
  }
  return runEncoder(value, 'CODE128');
}

/**
 * Compact scannable barcode as an inline SVG string sized for the picking
 * sheet. Bars are pure black on white with a quiet zone for reliable scans.
 * Default height is the practical minimum for handheld retail scanners.
 */
export function barcodeSvg(value: string, heightPx = 20): string | null {
  const binary = encodeBinary(value);
  if (!binary) return null;

  const quietZone = 6; // modules of white either side
  const totalModules = binary.length + quietZone * 2;
  const rects: string[] = [];
  let runStart = -1;
  for (let i = 0; i <= binary.length; i++) {
    const isBar = i < binary.length && binary[i] === '1';
    if (isBar && runStart === -1) runStart = i;
    if (!isBar && runStart !== -1) {
      rects.push(
        `<rect x="${runStart + quietZone}" y="0" width="${i - runStart}" height="${heightPx}"/>`,
      );
      runStart = -1;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${heightPx}" ` +
    `preserveAspectRatio="none" style="width:100%;height:${heightPx}px;" ` +
    `shape-rendering="crispEdges" fill="#000">${rects.join('')}</svg>`
  );
}
