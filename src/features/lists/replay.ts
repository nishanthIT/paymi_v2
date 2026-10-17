import type { MutationFunctionContext, QueryClient } from '@tanstack/react-query';
import type * as ListApi from './api';

type ListApiClient = Pick<typeof ListApi,
  'createList' | 'deleteList' | 'trackList' | 'untrackList' | 'renameList' |
  'addProductToList' | 'removeProductFromList' | 'updateProductQuantity' |
  'togglePurchased' | 'toggleUrgent' | 'changeProductShop' | 'moveProductToList' |
  'markProductOutOfStock' | 'claimBundle'>;

function listIdFor(input: { listId?: string } | string, context: MutationFunctionContext): string {
  const id = typeof input === 'object' ? input.listId : undefined;
  const scopedId = id ?? context.mutationKey?.[2];
  if (typeof scopedId !== 'string' || !scopedId || scopedId.startsWith('optimistic-')) {
    // Older saved mutations omitted this ID. Never guess a target list.
    throw new Error('This saved change has no verified list. Open the original list and apply the change again.');
  }
  return scopedId;
}

/** Uses the same serializable hook inputs after a restart, without relying on closed-over list IDs. */
export function installListReplay(client: QueryClient, api: ListApiClient) {
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['lists'] });
    client.invalidateQueries({ queryKey: ['list'] });
  };
  const defaults = (operation: string, mutationFn: (input: any, context: MutationFunctionContext) => Promise<unknown>) =>
    client.setMutationDefaults(['lists', operation], { mutationFn, onSettled: refresh, retry: false });

  defaults('create', api.createList);
  defaults('delete', api.deleteList);
  defaults('track', api.trackList);
  defaults('untrack', api.untrackList);
  defaults('rename', api.renameList);
  defaults('claim-bundle', api.claimBundle);
  defaults('add-product', (input) => api.addProductToList({
    listId: input.listId, productId: input.product?.id ?? input.productId,
    quantity: input.quantity, isUrgent: input.isUrgent, inHandStock: input.inHandStock,
  }));
  defaults('remove-product', (input, context) => api.removeProductFromList({
    listId: listIdFor(input, context), productId: typeof input === 'string' ? input : input.productId,
    ...(typeof input === 'object' && input.listProductId ? { listProductId: input.listProductId } : {}),
  }));
  defaults('update-quantity', (input, context) => api.updateProductQuantity({ ...input, listId: listIdFor(input, context) }));
  defaults('toggle-purchased', (input, context) => api.togglePurchased({
    listId: listIdFor(input, context), listProductId: typeof input === 'string' ? input : input.listProductId,
  }));
  defaults('toggle-urgent', (input, context) => api.toggleUrgent({
    listId: listIdFor(input, context), listProductId: typeof input === 'string' ? input : input.listProductId,
  }));
  defaults('change-shop', (input, context) => api.changeProductShop({ ...input, listId: listIdFor(input, context) }));
  defaults('move-to-list', (input, context) => api.moveProductToList({ ...input, listId: listIdFor(input, context) }));
  defaults('mark-out-of-stock', (input, context) => api.markProductOutOfStock({ ...input, listId: listIdFor(input, context) }));
}
