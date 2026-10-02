/**
 * Adapter over the existing catalogue endpoints (/products/barcode, /products/search).
 * Only RRP is used as a price source — shop/supplier/wholesale prices are ignored (spec §1).
 */
import * as listApi from '@/features/lists/api';
import type { Product } from '@/features/lists/types';
import { getProductImageUrl } from '@/utils/product-image';

import type { CatalogueLookupResult } from './model/label-item';

// Some catalogue rows store the literal text "null"/"N/A" instead of a real value.
function cleanText(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text && !/^(null|undefined|n\/a)$/i.test(text) ? text : null;
}

export function toLookupResult(product: Product): CatalogueLookupResult {
  return {
    id: product.id,
    title: product.title,
    barcode: product.barcode ?? null,
    retailSize: cleanText(product.retailSize),
    rrp: product.rrp ?? null,
    imageUri: getProductImageUrl(product.img as never, product.barcode ?? null),
  };
}

/** Exact-string lookup; null = unknown code. Throws on network/server failure. */
export async function lookupBarcode(barcode: string): Promise<CatalogueLookupResult | null> {
  const product = await listApi.fetchProductByBarcode(barcode);
  return product ? toLookupResult(product) : null;
}

export async function searchCatalogue(query: string): Promise<CatalogueLookupResult[]> {
  const products = await listApi.searchProducts(query);
  return products.map(toLookupResult);
}
