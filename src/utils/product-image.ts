import { API_CONFIG } from '@/config/api';

/**
 * Product images arrive in several shapes:
 *  - full URL, relative `/api/image/<ean>`, relative `/images/<file>`,
 *  - object `{ url, ean, ... }`, or null (fall back to barcode lookup).
 */

export interface ProductImageData {
  ean?: string;
  url?: string;
  type?: string;
  category?: string;
  filename?: string | null;
}

const BACKEND_BASE_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');

export function getProductImageUrl(
  img: string | ProductImageData | null | undefined,
  barcode?: string | null,
): string | null {
  if (!img && !barcode) return null;

  if (!img && barcode) {
    return `${BACKEND_BASE_URL}/api/image/${barcode}`;
  }

  if (typeof img === 'string') {
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('/')) return `${BACKEND_BASE_URL}${img}`;
    return `${BACKEND_BASE_URL}/${img}`;
  }

  if (img && typeof img === 'object') {
    if (img.url) return getProductImageUrl(img.url, barcode);
    if (img.ean) return `${BACKEND_BASE_URL}/api/image/${img.ean}`;
  }

  if (barcode) return `${BACKEND_BASE_URL}/api/image/${barcode}`;
  return null;
}
