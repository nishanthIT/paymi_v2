import api from '@/services/api';

import type { Compartment, EntrySlot, Fridge, FridgeInput, FridgeTodayStatus, TemperatureLog } from './types';

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export async function fetchFridges(includeInactive = false): Promise<Fridge[]> {
  try {
    const response = await api.get('/fridges', { params: { includeInactive } });
    return response.data?.fridges ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load equipment');
  }
}

export async function createFridge(input: FridgeInput): Promise<void> {
  try {
    await api.post('/fridges', input);
  } catch (error: any) {
    throw apiError(error, 'Could not create equipment');
  }
}

export async function updateFridge(id: string, input: Partial<FridgeInput>): Promise<void> {
  try {
    await api.put(`/fridges/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update equipment');
  }
}

export async function deleteFridge(id: string): Promise<void> {
  try {
    await api.delete(`/fridges/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete equipment');
  }
}

export async function fetchTodayStatus(): Promise<FridgeTodayStatus[]> {
  try {
    const response = await api.get('/fridges/today-status');
    return response.data?.fridges ?? [];
  } catch (error: any) {
    throw apiError(error, "Could not load today's readings");
  }
}

export async function addLog(
  fridgeId: string,
  input: { temperature: number; entryType: EntrySlot; compartment: Compartment; notes?: string },
): Promise<TemperatureLog> {
  try {
    const response = await api.post(`/fridges/${fridgeId}/logs`, input);
    return response.data?.log;
  } catch (error: any) {
    throw apiError(error, 'Could not save the reading');
  }
}

export async function fetchAllLogs(params: {
  fridgeId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<TemperatureLog[]> {
  try {
    const response = await api.get('/fridges/all-logs', { params });
    return response.data?.logs ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load history');
  }
}
