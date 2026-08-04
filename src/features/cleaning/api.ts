import api from '@/services/api';

import type { CleaningArea, CleaningAreaStatus, CleaningLog, CleaningSummary } from './types';

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export async function fetchAreas(includeInactive = false): Promise<CleaningArea[]> {
  try {
    const response = await api.get('/cleaning/areas', { params: { includeInactive } });
    return response.data?.areas ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load cleaning areas');
  }
}

export async function createArea(input: { name: string; description?: string }): Promise<void> {
  try {
    await api.post('/cleaning/areas', input);
  } catch (error: any) {
    throw apiError(error, 'Could not create the area');
  }
}

export async function updateArea(
  id: string,
  input: { name?: string; description?: string; isActive?: boolean },
): Promise<void> {
  try {
    await api.put(`/cleaning/areas/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the area');
  }
}

export async function deleteArea(id: string): Promise<void> {
  try {
    await api.delete(`/cleaning/areas/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the area');
  }
}

export async function fetchToday(): Promise<{
  summary: CleaningSummary;
  areas: CleaningAreaStatus[];
}> {
  try {
    const response = await api.get('/cleaning/today');
    return {
      summary: response.data?.summary ?? { completedCount: 0, totalCount: 0, percentage: 0 },
      areas: response.data?.areas ?? [],
    };
  } catch (error: any) {
    throw apiError(error, "Could not load today's checklist");
  }
}

export async function completeArea(areaId: string, notes?: string): Promise<void> {
  try {
    await api.post(`/cleaning/complete/${areaId}`, { notes });
  } catch (error: any) {
    throw apiError(error, 'Could not mark as cleaned');
  }
}

export async function undoArea(areaId: string): Promise<void> {
  try {
    await api.delete(`/cleaning/undo/${areaId}`);
  } catch (error: any) {
    throw apiError(error, 'Could not undo');
  }
}

export async function fetchHistory(params: {
  areaId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<CleaningLog[]> {
  try {
    const response = await api.get('/cleaning/history', { params });
    return response.data?.logs ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load history');
  }
}
