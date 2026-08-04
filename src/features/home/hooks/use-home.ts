import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as homeApi from '../api';
import { homeKeys } from '../keys';
import type { NewsItem } from '../types';

/**
 * All home data is persisted by the global AsyncStorage query persister,
 * so cold starts render instantly from cache while refetching in background.
 */
export function useAdvertisements() {
  return useQuery({
    queryKey: homeKeys.advertisements,
    queryFn: homeApi.fetchAdvertisements,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNews() {
  return useQuery({
    queryKey: homeKeys.news,
    queryFn: () => homeApi.fetchNews(20),
    staleTime: 5 * 60 * 1000,
  });
}

/** Single article, seeded from the list cache so it opens instantly. */
export function useNewsItem(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: homeKeys.newsItem(id),
    queryFn: () => homeApi.fetchNewsItem(id),
    initialData: () =>
      queryClient.getQueryData<NewsItem[]>(homeKeys.news)?.find((n) => n.id === id),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePromotions() {
  return useQuery({
    queryKey: homeKeys.promotions,
    queryFn: homeApi.fetchPromotions,
    staleTime: 5 * 60 * 1000,
  });
}
