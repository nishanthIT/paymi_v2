import api from '@/services/api';

export interface ShiftSheetRecord {
  id: string;
  shiftDate: string;
  cashTotal: string | number;
  cardTotal: string | number;
  totalSales: string | number;
  notes?: string | null;
  recordedBy: string;
  createdById: number;
  createdByType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSheetInput {
  shiftDate: string;
  cashTotal: number;
  cardTotal: number;
  notes?: string;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const shiftSheetKeys = {
  list: (filters: Record<string, string | undefined>) => ['shift-sheet', filters] as const,
};

export async function fetchShiftSheets(params: {
  startDate?: string;
  endDate?: string;
  recordedBy?: string;
  limit?: number;
}): Promise<ShiftSheetRecord[]> {
  try {
    const response = await api.get('/shift-sheet', { params });
    return response.data?.records ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load shift sheets');
  }
}

export async function createShiftSheet(input: ShiftSheetInput): Promise<void> {
  try {
    await api.post('/shift-sheet', input);
  } catch (error: any) {
    throw apiError(error, 'Could not save the shift sheet');
  }
}

export async function updateShiftSheet(id: string, input: Partial<ShiftSheetInput>): Promise<void> {
  try {
    await api.put(`/shift-sheet/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the shift sheet');
  }
}

export async function deleteShiftSheet(id: string): Promise<void> {
  try {
    await api.delete(`/shift-sheet/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the shift sheet');
  }
}
