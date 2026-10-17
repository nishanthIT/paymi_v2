import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Wire React Query's online status to the device network state so
 * mutations fired while offline are paused and auto-resumed on reconnect.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

/** Refetch stale data when the app returns to the foreground. */
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
});

export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data instantly, refresh silently in the background.
      staleTime: 30 * 1000,
      gcTime: 7 * DAY_MS,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: 'online', // pause while offline, resume on reconnect
      gcTime: 7 * DAY_MS,
    },
  },
});

// The exported binding always points at the mounted identity + supermarket cache.
export let queryClient = createQueryClient();
export const setActiveQueryClient = (client: QueryClient) => { queryClient = client; };
export const createQueryPersister = (scopeKey: string) => createAsyncStoragePersister({
  storage: AsyncStorage,
  key: `paymi.query-cache.v2.${scopeKey}`,
  throttleTime: 200,
});
export const QUERY_PERSIST_MAX_AGE = 7 * DAY_MS;
