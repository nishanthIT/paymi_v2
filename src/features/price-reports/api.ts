import api from '@/services/api';

import type { ReportProduct, ReportShop, ShopPrice, SubmitPriceReportInput } from './types';

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  const message = error?.response?.data?.error ?? error?.response?.data?.message ?? fallback;
  return new Error(message);
}

/** Fuzzy product search tuned for price reporting (handles typos & partials). */
export async function searchReportProducts(term: string, limit = 12): Promise<ReportProduct[]> {
  try {
    const response = await api.get('/price-reports/products/search', {
      params: { q: term, limit },
    });
    return response.data?.products ?? [];
  } catch (error: any) {
    throw apiError(error, 'Product search failed');
  }
}

/** All shops that stock the given product. */
export async function fetchShopsForProduct(productId: string): Promise<ReportShop[]> {
  try {
    const response = await api.get(`/price-reports/products/${productId}/shops`, {
      params: { limit: 50 },
    });
    return response.data?.shops ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load shops for this product');
  }
}

/** Current price of the product at one shop. */
export async function fetchShopPrice(productId: string, shopId: string): Promise<ShopPrice> {
  try {
    const response = await api.get(`/price-reports/product/${productId}/shop/${shopId}/price`);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Could not load the current price');
  }
}

/** Submit a wrong-price report for admin review. */
export async function submitPriceReport(input: SubmitPriceReportInput): Promise<void> {
  try {
    await api.post('/price-reports', input);
  } catch (error: any) {
    throw apiError(error, 'Could not submit the price report');
  }
}
