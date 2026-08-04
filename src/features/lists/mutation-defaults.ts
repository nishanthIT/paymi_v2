import type { QueryClient } from '@tanstack/react-query';

import * as listApi from './api';

/**
 * Registers default mutationFns so mutations paused while offline can be
 * rehydrated from disk and resumed after an app restart + reconnect.
 */
export function registerListMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(['lists', 'create'], {
    mutationFn: listApi.createList,
  });
  queryClient.setMutationDefaults(['lists', 'delete'], {
    mutationFn: listApi.deleteList,
  });
  queryClient.setMutationDefaults(['lists', 'add-product'], {
    mutationFn: (input: { listId: string; productId: string; quantity?: number }) =>
      listApi.addProductToList(input),
  });
  queryClient.setMutationDefaults(['lists', 'remove-product'], {
    mutationFn: listApi.removeProductFromList,
  });
  queryClient.setMutationDefaults(['lists', 'update-quantity'], {
    mutationFn: listApi.updateProductQuantity,
  });
  queryClient.setMutationDefaults(['lists', 'toggle-purchased'], {
    mutationFn: listApi.togglePurchased,
  });
}
