import api from '@/services/api';

export type ExpiryStatus = 'OK' | 'NOTICE' | 'WARNING' | 'CRITICAL' | 'EXPIRED' | 'DISPOSED';
export type ExpiryFilter = 'all' | 'active' | 'expiring-soon' | 'expired' | 'disposed';

export interface ExpiryProduct {
  id: string;
  productId: string;
  productName: string;
  productBarcode?: string | null;
  productImage?: string | null;
  productCategory?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  expiryDate: string;
  quantity: number;
  batchNumber?: string | null;
  notes?: string | null;
  isDisposed: boolean;
  disposedAt?: string | null;
  daysUntilExpiry: number;
  status: ExpiryStatus;
  createdAt: string;
}

export interface ExpiryCounts {
  all: number;
  expiringSoon: number;
  expired: number;
  disposed: number;
}

export interface ExpiryCategory {
  id: string;
  name: string;
  description?: string | null;
  reminderDays: number[];
  isActive: boolean;
  productCount?: number;
}

export interface ExpiryNotification {
  id: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  quantity: number;
}

export interface ExpirySearchProduct {
  id: string;
  title: string;
  barcode?: string | null;
  img?: string | null;
  category?: string | null;
  rrp?: string | number | null;
}

export interface ExpiryInput {
  productId: string;
  expiryDate: string;
  quantity: number;
  batchNumber?: string;
  notes?: string;
  categoryId?: string;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const expiryKeys = {
  list: (filter: ExpiryFilter) => ['expiry', 'list', filter] as const,
  notifications: ['expiry', 'notifications'] as const,
  categories: ['expiry', 'categories'] as const,
};

export async function fetchExpiryProducts(
  filter: ExpiryFilter,
): Promise<{ products: ExpiryProduct[]; counts: ExpiryCounts }> {
  try {
    const response = await api.get('/expiry', { params: { filter } });
    return {
      products: response.data?.products ?? [],
      counts: response.data?.counts ?? { all: 0, expiringSoon: 0, expired: 0, disposed: 0 },
    };
  } catch (error: any) {
    throw apiError(error, 'Could not load expiry products');
  }
}

export async function addExpiryProduct(input: ExpiryInput): Promise<void> {
  try {
    await api.post('/expiry', input);
  } catch (error: any) {
    throw apiError(error, 'Could not add the product');
  }
}

export async function updateExpiryProduct(
  id: string,
  input: Partial<ExpiryInput> & { isDisposed?: boolean },
): Promise<void> {
  try {
    await api.put(`/expiry/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the product');
  }
}

export async function deleteExpiryProduct(id: string): Promise<void> {
  try {
    await api.delete(`/expiry/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not remove the product');
  }
}

export async function fetchExpiryNotifications(): Promise<ExpiryNotification[]> {
  try {
    const response = await api.get('/expiry/notifications');
    return response.data?.notifications ?? [];
  } catch {
    return [];
  }
}

export async function searchExpiryProducts(params: {
  query?: string;
  barcode?: string;
}): Promise<ExpirySearchProduct[]> {
  try {
    const response = await api.get('/expiry/search-product', { params });
    return response.data?.products ?? [];
  } catch (error: any) {
    throw apiError(error, 'Product search failed');
  }
}

export async function fetchExpiryCategories(): Promise<ExpiryCategory[]> {
  try {
    const response = await api.get('/expiry/categories');
    return response.data?.categories ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load categories');
  }
}

export async function createExpiryCategory(input: {
  name: string;
  description?: string;
  reminderDays: number[];
}): Promise<void> {
  try {
    await api.post('/expiry/categories', input);
  } catch (error: any) {
    throw apiError(error, 'Could not create the category');
  }
}

export async function updateExpiryCategory(
  id: string,
  input: { name?: string; description?: string; reminderDays?: number[]; isActive?: boolean },
): Promise<void> {
  try {
    await api.put(`/expiry/categories/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the category');
  }
}

export async function deleteExpiryCategory(id: string): Promise<void> {
  try {
    await api.delete(`/expiry/categories/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the category');
  }
}
