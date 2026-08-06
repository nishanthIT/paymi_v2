import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchProductComparison } from '../api';
import { buildPurchaseOptions } from '../engine';
import { compareKeys } from '../keys';
import type { PurchaseOption } from '../types';

const COMPARE_STALE_TIME = 60 * 1000;

/**
 * Fetches the comparison payload and derives ranked purchase options.
 * Returns `undefined` for `options` while loading so callers can render skeletons.
 */
export function useCompareProduct(productId: string | undefined) {
  const query = useQuery({
    queryKey: compareKeys.product(productId ?? ''),
    queryFn: () => fetchProductComparison(productId!),
    enabled: !!productId,
    staleTime: COMPARE_STALE_TIME,
  });

  const options = useMemo<PurchaseOption[] | undefined>(() => {
    if (!query.data) return undefined;
    return buildPurchaseOptions(query.data);
  }, [query.data]);

  return {
    ...query,
    options,
  };
}
