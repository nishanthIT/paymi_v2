import api from '@/services/api';

export type PaymentStatus = 'TO_PAY' | 'PAID';
export type PaymentMethod = 'CASH' | 'CARD';

export interface SupplierPayoutRecord {
  id: string;
  supplier: string;
  amount: string | number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayoutInput {
  supplier: string;
  amount: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const payoutKeys = {
  list: (filters: Record<string, string | undefined>) => ['supplier-payouts', filters] as const,
};

export async function fetchPayouts(params: {
  startDate?: string;
  endDate?: string;
  supplier?: string;
  paymentStatus?: PaymentStatus;
  limit?: number;
}): Promise<SupplierPayoutRecord[]> {
  try {
    const response = await api.get('/supplier-payouts', { params });
    return response.data?.records ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load payout records');
  }
}

export async function createPayout(input: SupplierPayoutInput): Promise<void> {
  try {
    const record = await api.post('/supplier-payouts', input);
    // Backend drops `notes` on create — persist it with a follow-up update.
    const id = record.data?.record?.id;
    if (input.notes && id) {
      await api.put(`/supplier-payouts/${id}`, { notes: input.notes }).catch(() => {});
    }
  } catch (error: any) {
    throw apiError(error, 'Could not save the payout');
  }
}

export async function updatePayout(id: string, input: Partial<SupplierPayoutInput>): Promise<void> {
  try {
    await api.put(`/supplier-payouts/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the payout');
  }
}

export async function deletePayout(id: string): Promise<void> {
  try {
    await api.delete(`/supplier-payouts/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the payout');
  }
}
