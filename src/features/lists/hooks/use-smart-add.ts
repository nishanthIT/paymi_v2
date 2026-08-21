import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/toast';

import * as listApi from '../api';
import { listKeys } from '../keys';
import type { BundleCheckResult, BundleOffer, ListDetails, Product } from '../types';
import { useAddProduct } from './use-list-details';

/** Pack size options for a product (single / pack / case with unit prices). */
export function usePackOptions(productId: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.packOptions(productId ?? ''),
    queryFn: () => listApi.fetchPackOptions(productId!),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Quantity-based price tiers set by the shop (e.g. 7 for £9.00). */
export function usePriceTiers(productId: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.priceTiers(productId ?? ''),
    queryFn: () => listApi.fetchPriceTiers(productId!),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface BundlePrompt {
  product: Product;
  quantity: number;
  check: BundleCheckResult;
  offer: BundleOffer;
  /** Urgent/in-hand-stock flags chosen before the bundle prompt appeared. */
  addOptions?: AddOptions;
}

export interface AddOptions {
  isUrgent?: boolean;
  inHandStock?: number;
}

/**
 * Smart add flow shared by the scanner and product search:
 * 1. checks the backend for an active bundle offer on the product,
 * 2. if one exists, surfaces a prompt so the user chooses bundle vs single,
 * 3. otherwise adds normally. The check degrades gracefully offline.
 */
export function useSmartAdd(listId: string | undefined) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const addProduct = useAddProduct();

  const [bundlePrompt, setBundlePrompt] = useState<BundlePrompt | null>(null);
  const [checkingProductId, setCheckingProductId] = useState<string | null>(null);

  const claimBundle = useMutation({
    mutationKey: ['lists', 'claim-bundle'],
    mutationFn: listApi.claimBundle,
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(input.listId) });
      queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
  });

  const addSingleNow = useCallback(
    (product: Product, quantity: number, addOptions?: AddOptions) => {
      if (!listId) return;
      const cached = queryClient.getQueryData<ListDetails>(listKeys.detail(listId));
      const wasInList = (cached?.products ?? []).some((p) => p.productId === product.id);
      addProduct.mutate(
        { listId, product, quantity, ...addOptions },
        {
          onSuccess: (result) => {
            showToast(
              wasInList || result?.alreadyExists
                ? `Quantity increased — ${product.title}`
                : `Added ${product.title}`,
              'success',
            );
          },
          onError: (error) => showToast(error.message, 'error'),
        },
      );
    },
    [addProduct, listId, queryClient, showToast],
  );

  /**
   * Entry point for every add. Resolves to 'added' when the product went in
   * directly, or 'prompted' when a bundle offer sheet is now showing.
   *
   * `presentDelayMs` lets a caller wait for a closing modal (e.g. the product
   * details sheet) to finish dismissing before the bundle sheet is presented —
   * iOS silently drops a modal presented while another is still dismissing.
   */
  const requestAdd = useCallback(
    async (
      product: Product,
      quantity: number,
      options?: { presentDelayMs?: number } & AddOptions,
    ): Promise<'added' | 'prompted'> => {
      if (!listId) return 'added';
      const addOptions: AddOptions = {
        isUrgent: options?.isUrgent,
        inHandStock: options?.inHandStock,
      };
      setCheckingProductId(product.id);
      const check = await listApi.checkBundleBeforeAdd({ productId: product.id, listId });
      setCheckingProductId(null);
      const offer = check?.hasOffers ? check.offers[0] : null;
      if (check && offer) {
        if (options?.presentDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.presentDelayMs));
        }
        setBundlePrompt({ product, quantity, check, offer, addOptions });
        return 'prompted';
      }
      addSingleNow(product, quantity, addOptions);
      return 'added';
    },
    [addSingleNow, listId],
  );

  const dismissBundle = useCallback(() => setBundlePrompt(null), []);

  /** "Add Single Product" from the bundle sheet. */
  const addSingleFromPrompt = useCallback(() => {
    if (!bundlePrompt) return;
    const { product, quantity, addOptions } = bundlePrompt;
    setBundlePrompt(null);
    addSingleNow(product, quantity, addOptions);
  }, [addSingleNow, bundlePrompt]);

  /** "Add Bundle" — claims the offer so buy quantity + free items land in the list. */
  const addBundleFromPrompt = useCallback(() => {
    if (!bundlePrompt || !listId) return;
    const { product, quantity, check, offer } = bundlePrompt;
    claimBundle.mutate(
      {
        listId,
        productAtShopId: check.productAtShopId,
        bundlePromotionId: offer.bundlePromotionId,
        quantity: Math.max(quantity, offer.buyQuantityRequired),
      },
      {
        onSuccess: () => {
          setBundlePrompt(null);
          showToast(`Bundle added — ${product.title}`, 'success');
        },
        onError: (error: any) => {
          if (!error?.silent) showToast(error?.message ?? 'Failed to add bundle', 'error');
        },
      },
    );
  }, [bundlePrompt, claimBundle, listId, showToast]);

  return {
    requestAdd,
    checkingProductId,
    bundlePrompt,
    dismissBundle,
    addSingleFromPrompt,
    addBundleFromPrompt,
    isClaiming: claimBundle.isPending,
  };
}
