import { API_CONFIG } from '../config/api';

export interface ProductImageData {
  ean?: string;
  url?: string;
  uri?: string;
  type?: string;
  category?: string;
  filename?: string | null;
}

const BACKEND_BASE_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && !/^(null|undefined|n\/a|none|\[object Object\])$/i.test(text) ? text : null;
}

function barcodeUrl(value: unknown): string | null {
  const barcode = cleanText(value);
  if (!barcode || /[\/\\\u0000-\u001f]/.test(barcode) || barcode === '.' || barcode === '..') return null;
  return `${BACKEND_BASE_URL}/api/image/${encodeURIComponent(barcode)}`;
}

function normalizeUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  // Label editors may use a photo picked locally before it is uploaded.
  if (/^(file|content|ph|assets-library):\/\//i.test(text) || /^blob:/i.test(text) || /^data:image\//i.test(text)) return text;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text.startsWith('//') ? `https:${text}` : text, `${BACKEND_BASE_URL}/`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const backend = new URL(BACKEND_BASE_URL);
    // Old catalogue entries use http even when the API now requires HTTPS.
    if (backend.protocol === 'https:' && url.host === backend.host) url.protocol = 'https:';
    return url.href;
  } catch {
    return null;
  }
}

/** Try the supplier URL first, then locally stored EAN/barcode images, once each. */
export function getProductImageCandidates(img: unknown, barcode?: string | null): string[] {
  const candidates: (string | null)[] = [];
  let image = img;
  // Some older API responses serialize the JSON img column as a string.
  if (typeof image === 'string' && image.trim().startsWith('{')) {
    try { image = JSON.parse(image); } catch { image = null; }
  }
  if (typeof image === 'string') {
    candidates.push(normalizeUrl(image));
  } else if (image && typeof image === 'object' && !Array.isArray(image)) {
    const data = image as Record<string, unknown>;
    candidates.push(normalizeUrl(data.url), normalizeUrl(data.uri));
    const filename = cleanText(data.filename);
    if (filename) candidates.push(normalizeUrl(filename.includes('/') ? filename : `/images/${filename}`));
    candidates.push(barcodeUrl(data.ean));
  }
  candidates.push(barcodeUrl(barcode));
  return [...new Set(candidates.filter((url): url is string => url !== null))];
}

export function getProductImageUrl(img: unknown, barcode?: string | null): string | null {
  return getProductImageCandidates(img, barcode)[0] ?? null;
}
