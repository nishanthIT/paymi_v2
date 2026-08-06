export const compareKeys = {
  all: ['compare'] as const,
  product: (productId: string) => ['compare', 'product', productId] as const,
};
