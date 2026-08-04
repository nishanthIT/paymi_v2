import {
  keepPreviousData,
  useMutation,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

import {
  fetchShopPrice,
  fetchShopsForProduct,
  searchReportProducts,
  submitPriceReport,
} from './api';
import { priceReportKeys } from './keys';
import type { SubmitPriceReportInput } from './types';

const SUBMIT_KEY = ['price-reports', 'submit'] as const;

/**
 * Registered on the query client so offline price reports queued while
 * shopping are replayed after an app restart.
 */
export function registerPriceReportMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(SUBMIT_KEY, {
    mutationFn: (input: SubmitPriceReportInput) => submitPriceReport(input),
  });
}

/** Debounced fuzzy product search for the wrong-price flow. */
export function useReportProductSearch(rawQuery: string) {
  const debounced = useDebouncedValue(rawQuery.trim(), 300);
  const isSearchActive = debounced.length >= 2;

  const query = useQuery({
    queryKey: priceReportKeys.productSearch(debounced),
    queryFn: () => searchReportProducts(debounced),
    enabled: isSearchActive,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    searchTerm: debounced,
    isSearchActive,
    isDebouncing: rawQuery.trim() !== debounced,
  };
}

/** Shops carrying the selected product. */
export function useShopsForProduct(productId: string | null) {
  return useQuery({
    queryKey: priceReportKeys.shopsForProduct(productId ?? ''),
    queryFn: () => fetchShopsForProduct(productId!),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Live price at one shop (cached briefly — prices change rarely mid-trip). */
export function useShopPrice(productId: string | null, shopId: string | null) {
  return useQuery({
    queryKey: priceReportKeys.shopPrice(productId ?? '', shopId ?? ''),
    queryFn: () => fetchShopPrice(productId!, shopId!),
    enabled: !!productId && !!shopId,
    staleTime: 60 * 1000,
  });
}

/** Submit a wrong-price report (queues offline, replays on reconnect). */
export function useSubmitPriceReport() {
  return useMutation<void, Error, SubmitPriceReportInput>({
    mutationKey: SUBMIT_KEY,
    mutationFn: (input) => submitPriceReport(input),
  });
}
