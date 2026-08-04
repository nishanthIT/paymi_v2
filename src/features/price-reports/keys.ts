export const priceReportKeys = {
  productSearch: (term: string) => ['price-reports', 'product-search', term] as const,
  shopsForProduct: (productId: string) => ['price-reports', 'shops', productId] as const,
  shopPrice: (productId: string, shopId: string) =>
    ['price-reports', 'shop-price', productId, shopId] as const,
};
