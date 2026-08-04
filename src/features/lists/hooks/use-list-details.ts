import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as listApi from '../api';
import { listKeys } from '../keys';
import type { ListDetails, ListProduct, Product, ShoppingList } from '../types';

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
}

/**
 * Adds a product with an optimistic row. When the product is already in the
 * list, its quantity is bumped instead (mirrors backend behaviour).
 */
export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'add-product'],
    mutationFn: ({ listId, product, quantity }: AddProductInput) =>
      listApi.addProductToList({ listId, productId: product.id, quantity }),
    onMutate: async ({ listId, product, quantity }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousLists = queryClient.getQueryData<ShoppingList[]>(listKeys.all);

      const existing = previousDetail?.products?.find((p) => p.productId === product.id);

      if (existing) {
        patchListProducts(queryClient, listId, (products) =>
          products.map((p) =>
            p.productId === product.id ? { ...p, quantity: p.quantity + quantity } : p,
          ),
        );
      } else {
        const optimistic: ListProduct = {
          id: `optimistic-${product.id}`,
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
        };
        patchListProducts(queryClient, listId, (products) => [optimistic, ...products]);
        patchListItemCount(queryClient, listId, 1);
      }

      return { previousDetail, previousLists, alreadyInList: !!existing };
    },
    onError: (_error, { listId }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.all, context.previousLists);
      }
    },
    onSettled: (_data, _error, { listId }) => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistically removes a product row (all quantities of that product). */
export function useRemoveProduct(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'remove-product'],
    mutationFn: (productId: string) =>
      listApi.removeProductFromList({ listId, productId }),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const previousLists = queryClient.getQueryData<ShoppingList[]>(listKeys.all);

      patchListProducts(queryClient, listId, (products) =>
        products.filter((p) => p.productId !== productId),
      );
      patchListItemCount(queryClient, listId, -1);

      return { previousDetail, previousLists };
    },
    onError: (_error, _productId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.all, context.previousLists);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });
}

/** Optimistic absolute quantity update (min 1 enforced by callers). */
export function useUpdateQuantity(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'update-quantity'],
    mutationFn: ({ listProductId, quantity }: { listProductId: string; quantity: number }) =>
      listApi.updateProductQuantity({ listId, listProductId, quantity }),
    onMutate: async ({ listProductId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      patchListProducts(queryClient, listId, (products) =>
        products.map((p) => (p.id === listProductId ? { ...p, quantity } : p)),
      );
      return { previousDetail };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

/** Optimistic check-off toggle. */
export function useTogglePurchased(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['lists', 'toggle-purchased'],
    mutationFn: (listProductId: string) =>
      listApi.togglePurchased({ listId, listProductId }),
    onMutate: async (listProductId) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const previousDetail = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      patchListProducts(queryClient, listId, (products) =>
        products.map((p) =>
          p.id === listProductId ? { ...p, isPurchased: !p.isPurchased } : p,
        ),
      );
      return { previousDetail };
    },
    onError: (_error, _listProductId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(listKeys.detail(listId), context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}
