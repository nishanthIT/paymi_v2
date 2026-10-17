import api from '@/services/api';
import { API_CONFIG } from '@/config/api';

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/promotions/public`, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Could not load promotions. Please try again.');
    return (await response.json()).promotions ?? [];
  } finally { clearTimeout(timer); }
}
