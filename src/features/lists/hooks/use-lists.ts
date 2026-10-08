import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as listApi from '../api';
import { listKeys } from '../keys';
import type { ListDetails, ShoppingList } from '../types';

/**
 * Lists overview. Cached data renders instantly (persisted to disk),
 * fresh data is fetched silently in the background.
 */
export function useLists() {
  return useQuery({
    queryKey: listKeys.all,
    queryFn: listApi.fetchLists,
  });
}

/** Optimistically inserts the new list, reconciles with the server response. */
export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'create'],
    mutationFn: listApi.createList,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });
      const previous = queryClient.getQueryData<ShoppingList[]>(listKeys.all);

      const optimistic: ShoppingList = {
        id: `optimistic-${Date.now()}`,
        name: input.name,
        description: input.description ?? '',
        itemCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) => [
        optimistic,
        ...(old ?? []),
      ]);

      return { previous, optimisticId: optimistic.id };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKeys.all, context.previous);
      }
    },
    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) =>
        (old ?? []).map((list) => (list.id === context.optimisticId ? created : list)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistically removes the list; restores it if the server rejects. */
export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'delete'],
    mutationFn: listApi.deleteList,
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });
      const previous = queryClient.getQueryData<ShoppingList[]>(listKeys.all);
      queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) =>
        (old ?? []).filter((list) => list.id !== listId),
      );
      queryClient.removeQueries({ queryKey: listKeys.detail(listId) });
      return { previous };
    },
    onError: (_error, _listId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/**
 * Shop owner adds an employee's list to their own Shopping Lists (tracks the
 * SAME shared list, no duplicate). Refreshes the lists so it appears instantly.
 */
export function useTrackList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'track'],
    mutationFn: listApi.trackList,
    onSuccess: (_data, listId) => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

/** Stops tracking a shared list (optimistically removes it from my lists). */
export function useUntrackList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'untrack'],
    mutationFn: listApi.untrackList,
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });
      const previous = queryClient.getQueryData<ShoppingList[]>(listKeys.all);
      queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) =>
        (old ?? []).filter((list) => list.id !== listId),
      );
      queryClient.removeQueries({ queryKey: listKeys.detail(listId) });
      return { previous };
    },
    onError: (_error, _listId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Renames a list with an optimistic title update in both caches. */
export function useRenameList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'rename'],
    mutationFn: listApi.renameList,
    onMutate: async ({ listId, name }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });
      const previousLists = queryClient.getQueryData<ShoppingList[]>(listKeys.all);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));

      queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) =>
        (old ?? []).map((list) => (list.id === listId ? { ...list, name } : list)),
      );
      queryClient.setQueryData<ListDetails>(listKeys.detail(listId), (old) =>
        old ? { ...old, name } : old,
      );
      return { previousLists, previousDetail };
    },
    onError: (_error, { listId }, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.all, context.previousLists);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: (_data, _error, { listId }) => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}
