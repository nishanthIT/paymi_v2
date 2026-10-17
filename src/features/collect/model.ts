import type { ListProduct } from '../lists/types';

export interface ShopSummary {
  shopId: string;
  shopName: string;
  total: number;
  collected: number;
}

/** Supplier IDs distinguish different shops even when their names match. */
export function summarizeCollectionShops(products: readonly ListProduct[]): ShopSummary[] {
  const groups = new Map<string, ShopSummary>();
  for (const product of products) {
    const shopId = product.shopId || 'unknown';
    const summary = groups.get(shopId) ?? { shopId, shopName: product.shopName || 'Unknown shop', total: 0, collected: 0 };
    summary.total++;
    if (product.isPurchased) summary.collected++;
    groups.set(shopId, summary);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

export function collectionProducts(products: readonly ListProduct[], filters: {
  shopId?: string | null; category?: string | null; aisle?: string | null; urgentOnly?: boolean;
}) {
  return products.filter(product =>
    (!filters.shopId || (product.shopId || 'unknown') === filters.shopId) &&
    (!filters.category || product.category === filters.category) &&
    (!filters.aisle || (product.aielNumber || product.locationCode) === filters.aisle) &&
    (!filters.urgentOnly || product.isUrgent),
  ).sort((a, b) => {
    const bundleA = a.bundlePromotionId ?? '';
    const bundleB = b.bundlePromotionId ?? '';
    if (!!bundleA !== !!bundleB) return bundleA ? -1 : 1;
    if (bundleA !== bundleB) return bundleA.localeCompare(bundleB);
    if (bundleA && !!a.isFreeItem !== !!b.isFreeItem) return a.isFreeItem ? 1 : -1;
    if (a.isPurchased !== b.isPurchased) return a.isPurchased ? 1 : -1;
    const aisleA = a.aielNumber || a.locationCode || '';
    const aisleB = b.aielNumber || b.locationCode || '';
    if (aisleA !== aisleB) return aisleA.localeCompare(aisleB, undefined, { numeric: true, sensitivity: 'base' });
    return a.productName.localeCompare(b.productName);
  });
}
