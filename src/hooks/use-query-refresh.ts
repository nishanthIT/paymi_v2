import { useQueryClient, type FetchStatus, type RefetchOptions } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

type Refetch = (options?: RefetchOptions) => Promise<unknown>;

/**
 * Pull-to-refresh state driven only by the user's pull, so background
 * refetches (realtime, invalidations, focus) never show the native spinner.
 */
export function usePullToRefresh(refetch: Refetch, fetchStatus: FetchStatus) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [refetch]);

  // An offline (paused) refetch only settles after reconnecting.
  if (refreshing && fetchStatus === 'paused') setRefreshing(false);

  // A spinner left running on a blurred screen gets stuck on iOS.
  useFocusEffect(useCallback(() => () => setRefreshing(false), []));

  return { refreshing, onRefresh };
}

/** Silently refetches whenever the screen regains focus (mount already fetches). */
export function useRefetchOnFocus(refetch: Refetch) {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      // Optimistic updates in flight would be overwritten; their onSettled refetches anyway.
      if (queryClient.isMutating() > 0) return;
      refetch({ cancelRefetch: false });
    }, [queryClient, refetch]),
  );
}
