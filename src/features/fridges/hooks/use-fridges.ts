import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as fridgeApi from '../api';
import { fridgeKeys } from '../keys';
import type { Compartment, EntrySlot, FridgeInput } from '../types';

export function useFridges(includeInactive = false) {
  return useQuery({
    queryKey: [...fridgeKeys.list, includeInactive],
    queryFn: () => fridgeApi.fetchFridges(includeInactive),
    staleTime: 60_000,
  });
}

export function useTodayStatus() {
  return useQuery({
    queryKey: fridgeKeys.todayStatus,
    queryFn: fridgeApi.fetchTodayStatus,
    staleTime: 30_000,
  });
}

export function useAllLogs(filters: { fridgeId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: fridgeKeys.allLogs(filters),
    queryFn: () => fridgeApi.fetchAllLogs({ ...filters, limit: 200 }),
    staleTime: 30_000,
  });
}

export function useFridgeMutations() {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['fridges'] });
  const create = useMutation({ mutationFn: fridgeApi.createFridge, onSettled });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<FridgeInput>) =>
      fridgeApi.updateFridge(id, input),
    onSettled,
  });
  const remove = useMutation({ mutationFn: fridgeApi.deleteFridge, onSettled });
  return { create, update, remove };
}

export function useAddTemperatureLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fridgeId,
      ...input
    }: {
      fridgeId: string;
      temperature: number;
      entryType: EntrySlot;
      compartment: Compartment;
      notes?: string;
    }) => fridgeApi.addLog(fridgeId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['fridges'] }),
  });
}
