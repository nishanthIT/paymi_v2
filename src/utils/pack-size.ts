/**
 * Pack size parsing + formatting shared across the whole app.
 *
 * Every product display shows a consistent size badge like "1 × 330ml" or
 * "24 × 330ml". Pack structure is parsed from packetSize/retailSize/title
 * (mirrors the backend's packComparison.js parser).
 */

export interface PackSizeInfo {
  /** Number of units in the pack — defaults to 1 when not stated. */
  count: number;
  /** Human size of one unit, e.g. "330ml" — null when unparseable. */
  sizeText: string | null;
}

const MULTI_RE = /(\d{1,4})\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ml|cl|ltr|l|litre|litres|g|gm|kg|oz)?\b/i;
const SINGLE_RE = /(\d+(?:\.\d+)?)\s*(ml|cl|ltr|l|litre|litres|g|gm|kg|oz)\b/i;

interface PackSource {
  title?: string | null;
  packetSize?: string | null;
  retailSize?: string | null;
}

function cleanSource(value?: string | null): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed && trimmed.toUpperCase() !== 'N/A' ? trimmed : '';
}

export function parsePackSize(product: PackSource): PackSizeInfo {
  const sources = [product.packetSize, product.retailSize, product.title]
    .map(cleanSource)
    .filter(Boolean);

  for (const source of sources) {
    const multi = source.match(MULTI_RE);
    if (multi) {
      return {
        count: parseInt(multi[1], 10) || 1,
        sizeText: multi[3] ? `${multi[2]}${multi[3].toLowerCase()}` : multi[2],
      };
    }
  }

  for (const source of sources) {
    const single = source.match(SINGLE_RE);
    if (single) {
      return { count: 1, sizeText: `${single[1]}${single[2].toLowerCase()}` };
    }
  }

  // No parseable measure — fall back to raw packet size text when present.
  const raw = cleanSource(product.packetSize);
  return { count: 1, sizeText: raw || null };
}

/** "24 × 330ml" / "1 × 330ml" — null when there is nothing worth showing. */
export function formatSizeLabel(product: PackSource): string | null {
  const { count, sizeText } = parsePackSize(product);
  if (!sizeText) return null;
  return `${count} × ${sizeText}`;
}
