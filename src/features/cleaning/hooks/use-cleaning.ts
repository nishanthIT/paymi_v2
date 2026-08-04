import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as cleaningApi from '../api';
import { cleaningKeys } from '../keys';
import type { CleaningAreaStatus, CleaningSummary } from '../types';

export function useCleaningAreas(includeInactive = false) {
  return useQuery({
    queryKey: [...cleaningKeys.areas, includeInactive],
    queryFn: () => cleaningApi.fetchAreas(includeInactive),
    staleTime: 60_000,
  });
}

export function useCleaningToday() {
  return useQuery({
    queryKey: cleaningKeys.today,
    queryFn: cleaningApi.fetchToday,
    staleTime: 30_000,
  });
}

export function useCleaningHistory(filters: {
  areaId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: cleaningKeys.history(filters),
    queryFn: () => cleaningApi.fetchHistory({ ...filters, limit: 100 }),
    staleTime: 30_000,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['cleaning'] });
}

export function useAreaMutations() {
  const queryClient = useQueryClient();
  const onSettled = () => invalidateAll(queryClient);
  const create = useMutation({ mutationFn: cleaningApi.createArea, onSettled });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; description?: string; isActive?: boolean }) =>
      cleaningApi.updateArea(id, input),
    onSettled,
  });
  const remove = useMutation({ mutationFn: cleaningApi.deleteArea, onSettled });
  return { create, update, remove };
}

type TodayData = { summary: CleaningSummary; areas: CleaningAreaStatus[] };

/** Optimistically toggles an area's completed state in the today checklist. */
export function useToggleCleaned(userName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ areaId, complete, notes }: { areaId: string; complete: boolean; notes?: string }) =>
      complete ? cleaningApi.completeArea(areaId, notes) : cleaningApi.undoArea(areaId),
    onMutate: async ({ areaId, complete, notes }) => {
      await queryClient.cancelQueries({ queryKey: cleaningKeys.today });
      const previous = queryClient.getQueryData<TodayData>(cleaningKeys.today);
      if (previous) {
        const areas = previous.areas.map((area) =>
          area.id === areaId
            ? {
                ...area,
                isCompleted: complete,
                completedAt: complete ? new Date().toISOString() : null,
                completedBy: complete ? userName : null,
                notes: complete ? (notes ?? null) : null,
              }
            : area,
        );
        const completedCount = areas.filter((a) => a.isCompleted).length;
        queryClient.setQueryData<TodayData>(cleaningKeys.today, {
          areas,
          summary: {
            completedCount,
            totalCount: areas.length,
            percentage: areas.length ? Math.round((completedCount / areas.length) * 100) : 0,
          },
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(cleaningKeys.today, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cleaningKeys.today });
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'history'] });
    },
  });
}
