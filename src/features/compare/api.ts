import api from '@/services/api';

import type { CompareResponse } from './types';

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error || fallback);
}

/** Loads every shop/price/offer/bundle for one product in one round trip. */
export async function fetchProductComparison(productId: string): Promise<CompareResponse> {
  try {
    const response = await api.get(`/products/${encodeURIComponent(productId)}/compare`);
    return response.data as CompareResponse;
  } catch (error: any) {
    throw apiError(error, 'Failed to load comparison');
  }
}
