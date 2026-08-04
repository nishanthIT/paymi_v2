import api from '@/services/api';

import type { Advertisement, NewsItem, Promotion } from './types';

/** GET /advertisements — active banners sorted by sortOrder. */
export async function fetchAdvertisements(): Promise<Advertisement[]> {
  const response = await api.get('/advertisements');
  return response.data?.advertisements ?? [];
}

/** GET /news — latest active news, newest first. */
export async function fetchNews(limit = 20): Promise<NewsItem[]> {
  const response = await api.get('/news', { params: { limit } });
  return response.data?.news ?? [];
}

/** GET /news/:id — single article. */
export async function fetchNewsItem(id: string): Promise<NewsItem> {
  const response = await api.get(`/news/${encodeURIComponent(id)}`);
  return response.data?.news;
}

/** GET /promotions?active=true — promotions with shop + priced products. */
export async function fetchPromotions(): Promise<Promotion[]> {
  const response = await api.get('/promotions', { params: { active: 'true' } });
  return response.data?.promotions ?? [];
}
