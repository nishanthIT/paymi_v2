import AsyncStorage from '@react-native-async-storage/async-storage';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

import * as listApi from '../api';
import { listKeys } from '../keys';
import type { Product } from '../types';

const RECENT_SEARCHES_KEY = 'paymi.recent-searches.v1';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_STALE_TIME = 5 * 60 * 1000;

/**
 * Debounced, backend-driven product search. Previous results stay on screen
 * while new ones load, and repeated terms resolve instantly from cache.
 */
export function useProductSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 300);
  const enabled = query.length >= 2;

  const result = useQuery({
    queryKey: listKeys.productSearch(query.toLowerCase()),
    queryFn: () => listApi.searchProducts(query),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    searchTerm: query,
    isSearchActive: enabled,
    isDebouncing: rawQuery.trim().length >= 2 && rawQuery.trim() !== query,
  };
}

/** Imperative barcode lookup that reuses the query cache (scanner-friendly). */
export function useBarcodeLookup() {
  const queryClient = useQueryClient();

  return useCallback(
    (barcode: string): Promise<Product | null> =>
      queryClient.fetchQuery({
        queryKey: listKeys.productBarcode(barcode),
        queryFn: () => listApi.fetchProductByBarcode(barcode),
        staleTime: 10 * 60 * 1000,
      }),
    [queryClient],
  );
}

/** Submits an unknown scanned barcode for admin review (backend quick-add). */
export function useSubmitNewProduct() {
  return useMutation({
    mutationKey: ['products', 'submit-new'],
    mutationFn: listApi.submitNewProduct,
  });
}

/** Recent search history persisted locally. */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (mounted && raw) setRecentSearches(JSON.parse(raw));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setRecentSearches((previous) => {
      const next = [clean, ...previous.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES,
      );
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
}
