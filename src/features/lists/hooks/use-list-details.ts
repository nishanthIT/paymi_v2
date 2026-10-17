import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as listApi from '../api';
import { listKeys } from '../keys';
import { applyOptimisticProductAdd } from '../list-management';
import { OUT_OF_STOCK_ID, patchOutOfStockSource, restoreOutOfStockSource } from '../out-of-stock';
import type { ListDetails, ListProduct, OutOfStockCollection, OutOfStockProduct, Product, ShoppingList } from '../types';

/** List details render instantly from cache and refresh in the background. */
export function useListDetails(listId: string) {
  return useQuery({
    queryKey: listKeys.detail(listId),
    queryFn: () => listApi.fetchListDetails(listId),
    enabled: !!listId,
  });
}

function patchListProducts(
  queryClient: ReturnType<typeof useQueryClient>,
  listId: string,
  updater: (products: ListProduct[]) => ListProduct[],
) {
  queryClient.setQueryData<ListDetails>(listKeys.detail(listId), (old) =>
    old ? { ...old, products: updater(old.products ?? []) } : old,
  );
  if (listId === OUT_OF_STOCK_ID) return;
  queryClient.setQueryData<OutOfStockCollection>(listKeys.outOfStock, old =>
    old ? patchOutOfStockSource(old, listId, updater) : old,
  );
}

function restoreOutOfStock(
  queryClient: ReturnType<typeof useQueryClient>,
  listId: string,
  products?: OutOfStockProduct[],
) {
  if (!products) return;
  queryClient.setQueryData<OutOfStockCollection>(listKeys.outOfStock, old =>
    old ? restoreOutOfStockSource(old, listId, products) : old,
  );
}

function patchListItemCount(
  queryClient: ReturnType<typeof useQueryClient>,
  listId: string,
  delta: number,
) {
  queryClient.setQueryData<ShoppingList[]>(listKeys.all, (old) =>
    (old ?? []).map((list) =>
      list.id === listId
        ? { ...list, itemCount: Math.max(0, (list.itemCount ?? 0) + delta) }
        : list,
    ),
  );
}

export interface AddProductInput {
  listId: string;
  product: Product;
  quantity: number;
  isUrgent?: boolean;
  inHandStock?: number;
}

/**
 * Adds a product with an optimistic row. When the product is already in the
 * list, its quantity is bumped instead (mirrors backend behaviour).
 */
export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'add-product'],
    mutationFn: ({ listId, product, quantity, isUrgent, inHandStock }: AddProductInput) =>
      listApi.addProductToList({ listId, productId: product.id, quantity, isUrgent, inHandStock }),
    onMutate: async ({ listId, product, quantity, isUrgent }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      const previousLists = queryClient.getQueryData<ShoppingList[]>(listKeys.all);

      const optimistic: ListProduct = {
        id: `optimistic-${product.id}-${Date.now()}`,
        productId: product.id,
        productAtShopId: '',
        productName: product.title,
        barcode: product.barcode ?? '',
        category: product.category ?? 'Uncategorized',
        lowestPrice: product.lowestPrice ?? 0,
        originalPrice: product.lowestPrice ?? 0,
        offerPrice: null,
        hasActiveOffer: false,
        shopName: '',
        shopId: '',
        img: typeof product.img === 'string' ? product.img : null,
        quantity,
        isPurchased: false,
        isUrgent: !!isUrgent,
      };
      const { alreadyInList } = applyOptimisticProductAdd(listId, previousDetail?.products ?? [], optimistic);
      patchListProducts(queryClient, listId, products => applyOptimisticProductAdd(listId, products, optimistic).products);
      if (!alreadyInList) patchListItemCount(queryClient, listId, 1);

      return { previousOutOfStock, previousDetail, previousLists, alreadyInList };
    },
    onError: (_error, { listId }, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.all, context.previousLists);
      }
    },
    onSettled: (_data, _error, { listId }) => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistically removes a product row (all quantities of that product). */
export function useRemoveProduct(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'remove-product', listId],
    mutationFn: (input: string | { productId: string; listProductId: string }) =>
      listApi.removeProductFromList({ listId, ...(typeof input === 'string' ? { productId: input } : input) }),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      const previousLists = queryClient.getQueryData<ShoppingList[]>(listKeys.all);

      patchListProducts(queryClient, listId, (products) =>
        products.filter((p) => typeof input === 'string' ? p.productId !== input : p.id !== input.listProductId),
      );
      patchListItemCount(queryClient, listId, -1);

      return { previousOutOfStock, previousDetail, previousLists };
    },
    onError: (_error, _productId, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.all, context.previousLists);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistic absolute quantity update (min 1 enforced by callers). */
export function useUpdateQuantity(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'update-quantity', listId],
    mutationFn: ({ listProductId, quantity }: { listProductId: string; quantity: number }) =>
      listApi.updateProductQuantity({ listId, listProductId, quantity }),
    onMutate: async ({ listProductId, quantity }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      patchListProducts(queryClient, listId, (products) =>
        products.map((p) => (p.id === listProductId ? { ...p, quantity } : p)),
      );
      return { previousOutOfStock, previousDetail };
    },
    onError: (_error, _input, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
    },
  });
}

/** Optimistic check-off toggle. */
export function useTogglePurchased(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'toggle-purchased', listId],
    mutationFn: (listProductId: string) =>
      listApi.togglePurchased({ listId, listProductId }),
    onMutate: async (listProductId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      patchListProducts(queryClient, listId, (products) =>
        products.map((p) =>
          p.id === listProductId ? { ...p, isPurchased: !p.isPurchased } : p,
        ),
      );
      return { previousOutOfStock, previousDetail };
    },
    onError: (_error, _listProductId, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
    },
  });
}

/** Optimistic urgent-flag toggle. */
export function useToggleUrgent(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'toggle-urgent', listId],
    mutationFn: (listProductId: string) =>
      listApi.toggleUrgent({ listId, listProductId }),
    onMutate: async (listProductId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      patchListProducts(queryClient, listId, (products) =>
        products.map((p) =>
          p.id === listProductId ? { ...p, isUrgent: !p.isUrgent } : p,
        ),
      );
      return { previousOutOfStock, previousDetail };
    },
    onError: (_error, _listProductId, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
    },
  });
}

/** Moves a list item to the same product at another shop, then refreshes the list. */
export function useChangeShop(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'change-shop', listId],
    mutationFn: (input: { listProductId: string; productAtShopId: string }) =>
      listApi.changeProductShop({ listId, ...input }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
    },
  });
}

function useMoveOutOfList<TInput extends { listProductId: string }>(
  listId: string,
  mutationKey: string,
  mutationFn: (input: TInput) => Promise<listApi.MoveToListResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', mutationKey, listId],
    mutationFn,
    onMutate: async ({ listProductId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.detail(listId) }),
        queryClient.cancelQueries({ queryKey: listKeys.outOfStock }),
      ]);
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousOutOfStock = queryClient.getQueryData<OutOfStockCollection>(listKeys.outOfStock)?.products.filter(product => product.listId === listId);
      patchListProducts(queryClient, listId, (products) =>
        products.filter((p) => p.id !== listProductId),
      );
      return { previousOutOfStock, previousDetail };
    },
    onError: (_error, _input, context) => {
      restoreOutOfStock(queryClient, listId, context?.previousOutOfStock);
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSuccess: (result) => {
      if (result?.targetListId) {
        queryClient.invalidateQueries({ queryKey: listKeys.detail(result.targetListId) });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      if (listId === OUT_OF_STOCK_ID) queryClient.invalidateQueries({ queryKey: ['list'] });
      queryClient.invalidateQueries({ queryKey: listKeys.outOfStock });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistically moves a list item into another of my lists. */
export function useMoveToList(listId: string) {
  return useMoveOutOfList(listId, 'move-to-list', (input: { listProductId: string; targetListId: string }) =>
    listApi.moveProductToList({ listId, ...input }),
  );
}

/** Optimistically moves a list item into the account's Out of Stock list (created on demand). */
export function useMarkOutOfStock(listId: string) {
  return useMoveOutOfList(listId, 'mark-out-of-stock', (input: { listProductId: string }) =>
    listApi.markProductOutOfStock({ listId, ...input }),
  );
}
