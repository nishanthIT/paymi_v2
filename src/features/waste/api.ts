import api from '@/services/api';

export type WasteReason = 'DAMAGED' | 'NEAR_EXPIRY' | 'SPOILED' | 'OTHER';

export interface WasteRecord {
  id: string;
  itemName: string;
  quantityWasted: number;
  originalPrice: string | number;
  reducedPrice?: string | number | null;
  priceReduced: boolean;
  priceReducedBy?: string | number | null;
  priceReductionReason?: WasteReason | null;
  priceReductionReasonNote?: string | null;
  totalLoss: string | number;
  disposedBy?: string | null;
  disposedAt?: string | null;
  createdAt: string;
}

export interface WasteInput {
  productId?: string;
  itemName: string;
  quantityWasted: number;
  originalPrice: number;
  reducedPrice?: number;
  priceReduced: boolean;
  priceReductionReason?: WasteReason;
  priceReductionReasonNote?: string;
  disposedBy?: string;
}

export interface WasteSummary {
  totalRecords: number;
  totalQuantity: number;
  totalLoss: number;
}

export interface ProductSearchHit {
  id: string;
  title: string;
  barcode?: string | null;
  img?: string | null;
  rrp?: string | number | null;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const wasteKeys = {
  list: (filters: Record<string, string | undefined>) => ['waste', filters] as const,
};

export async function fetchWaste(params: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{ records: WasteRecord[]; summary: WasteSummary }> {
  try {
    const response = await api.get('/waste', { params });
    const records: WasteRecord[] = response.data?.records ?? [];
    const summary = response.data?.summary ?? {};
    return {
      records,
      summary: {
        totalRecords: Number(summary.totalRecords ?? records.length),
        totalQuantity: Number(
          summary.totalQuantity ?? records.reduce((acc, r) => acc + Number(r.quantityWasted), 0),
        ),
        totalLoss: Number(
          summary.totalLoss ?? records.reduce((acc, r) => acc + Number(r.totalLoss), 0),
        ),
      },
    };
  } catch (error: any) {
    throw apiError(error, 'Could not load waste records');
  }
}

export async function createWaste(input: WasteInput): Promise<void> {
  try {
    await api.post('/waste', input);
  } catch (error: any) {
    throw apiError(error, 'Could not save the waste record');
  }
}

/** Reuses the expiry product search so users can pull in shop products. */
export async function searchProducts(query: string): Promise<ProductSearchHit[]> {
  try {
    const response = await api.get('/expiry/search-product', { params: { query } });
    return response.data?.products ?? [];
  } catch {
    return [];
  }
}
