import type { QueryClient } from '@tanstack/react-query';
import * as listApi from './api';
import { installListReplay } from './replay';

/** Restore paused list changes with their original list and exact API payload. */
export function registerListMutationDefaults(queryClient: QueryClient) {
  installListReplay(queryClient, listApi);
}
