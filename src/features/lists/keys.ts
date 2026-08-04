/** Centralised React Query keys for the lists feature. */
export const listKeys = {
  all: ['lists'] as const,
  detail: (listId: string) => ['list', listId] as const,
  productSearch: (term: string) => ['product-search', term] as const,
  productBarcode: (barcode: string) => ['product-barcode', barcode] as const,
  packOptions: (productId: string) => ['pack-options', productId] as const,
  priceTiers: (productId: string) => ['price-tiers', productId] as const,
};
