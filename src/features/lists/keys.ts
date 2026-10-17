/** Centralised React Query keys for the lists feature. */
export const listKeys = {
  all: ['lists'] as const,
  outOfStock: ['lists', 'out-of-stock'] as const,
  detail: (listId: string) => listId === 'out-of-stock' ? ['lists', 'out-of-stock'] as const : ['list', listId] as const,
  productSearch: (term: string) => ['product-search', term] as const,
  productBarcode: (barcode: string) => ['product-barcode', barcode] as const,
  categories: ['product-categories'] as const,
  packOptions: (productId: string) => ['pack-options', productId] as const,
  priceTiers: (productId: string) => ['price-tiers', productId] as const,
};
