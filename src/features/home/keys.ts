/** Centralised React Query keys for the home & promotions feature. */
export const homeKeys = {
  advertisements: ['advertisements'] as const,
  news: ['news'] as const,
  newsItem: (id: string) => ['news', id] as const,
  promotions: ['promotions'] as const,
};
