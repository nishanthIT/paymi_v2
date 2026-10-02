import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';

import { lookupBarcode } from '../catalogue';
import {
  createCustomItem,
  createPendingItem,
  draftReducer,
  emptyDraft,
  parseStoredDraft,
  type LabelDraft,
} from '../model/draft';
import type { CatalogueLookupResult, LabelItem } from '../model/label-item';
import { draftStorageKey } from '../model/library';

const SAVE_DEBOUNCE_MS = 400;

/** Drafts are namespaced per user + shop so one shop never sees another's work. */
function storageKey(userId: string, shopId: string, toolId: string) {
  return draftStorageKey(userId, shopId, toolId);
}

/**
 * Persistent label draft with scan queueing. Autosaves (debounced, never
 * blocking typing) and restores after navigation or app restart.
 */
export function useLabelDraft(toolId: string) {
  const { user } = useAuth();
  const key = user ? storageKey(String(user.id), String(user.shopId ?? 'none'), toolId) : null;

  const [draft, dispatch] = useReducer(draftReducer, toolId, emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        const stored = parseStoredDraft(raw, toolId);
        if (!cancelled && stored) dispatch({ type: 'hydrate', draft: stored });
      })
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [key, toolId]);

  useEffect(() => {
    // Never write the empty initial state over a stored draft before it loads.
    if (!key || !hydrated) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(draft)).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, hydrated, key]);

  // Leaving the editor inside the debounce window must not lose the last edit.
  const hydratedRef = useRef(false);
  useEffect(() => {
    hydratedRef.current = hydrated;
  }, [hydrated]);
  useEffect(
    () => () => {
      if (key && hydratedRef.current) AsyncStorage.setItem(key, JSON.stringify(draftRef.current)).catch(() => {});
    },
    [key],
  );

  const runLookup = useCallback(async (itemId: string, barcode: string) => {
    try {
      const result = await lookupBarcode(barcode);
      dispatch({ type: 'lookupResolved', itemId, result });
    } catch (error: any) {
      dispatch({
        type: 'lookupFailed',
        itemId,
        message: error?.silent ? 'Signed out' : (error?.message ?? 'Lookup failed'),
      });
    }
  }, []);

  /** One call = one label row. A repeat scan of the same code adds another facing. */
  const addScan = useCallback(
    (rawBarcode: string): LabelItem | null => {
      const barcode = rawBarcode.trim();
      if (!barcode) return null;
      const item = createPendingItem(barcode);
      dispatch({ type: 'scan', item });
      runLookup(item.id, barcode);
      return item;
    },
    [runLookup],
  );

  const retryLookup = useCallback(
    (itemId: string) => {
      const item = draftRef.current.items.find((i) => i.id === itemId);
      if (!item || !item.snapshot.barcode) return;
      dispatch({ type: 'update', itemId, update: (i) => ({ ...i, lookup: 'looking_up', lookupError: undefined }) });
      runLookup(itemId, item.snapshot.barcode);
    },
    [runLookup],
  );

  /** Add a product picked from search results (already resolved — no second lookup). */
  const addFromSearch = useCallback((result: CatalogueLookupResult): LabelItem => {
    const item = createPendingItem(result.barcode ?? '');
    dispatch({ type: 'scan', item });
    dispatch({ type: 'lookupResolved', itemId: item.id, result });
    return item;
  }, []);

  const addCustom = useCallback((barcode = ''): LabelItem => {
    const item = createCustomItem(barcode);
    dispatch({ type: 'addCustom', item });
    return item;
  }, []);

  const updateItem = useCallback((itemId: string, update: (item: LabelItem) => LabelItem) => {
    dispatch({ type: 'update', itemId, update });
  }, []);

  const removeItem = useCallback((itemId: string) => dispatch({ type: 'remove', itemId }), []);

  const setSettings = useCallback(
    (settings: Record<string, unknown>) => dispatch({ type: 'setSettings', settings }),
    [],
  );

  const clearDraft = useCallback(() => dispatch({ type: 'clear' }), []);

  return {
    draft,
    hydrated,
    addScan,
    retryLookup,
    addFromSearch,
    addCustom,
    updateItem,
    removeItem,
    setSettings,
    clearDraft,
  };
}

export type LabelDraftApi = ReturnType<typeof useLabelDraft>;
export type { LabelDraft };
