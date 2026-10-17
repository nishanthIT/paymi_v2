/** A saved/default selection is only a preference within the verified directory. */
export function selectSupermarket<T extends { id: string }>(shops: T[], saved: string | null, defaultId: string | null): T | null {
  return shops.find((shop) => shop.id === saved) ?? shops.find((shop) => shop.id === defaultId) ?? (shops.length === 1 ? shops[0] : null);
}
export function supermarketCacheKey(type: string, id: string, shopId?: string | null) {
  return `${type}.${id}.${shopId ?? 'unassigned'}`;
}
export function assertSwitchReady(pendingMutations: number, activeWrites: boolean) {
  if (pendingMutations || activeWrites) throw new Error('Finish syncing your pending changes before switching shops. Reconnect if you are offline.');
}

/** Recover an initially unavailable directory; a revoked active shop must not silently switch writes. */
export function selectRefreshedSupermarket<T extends { id: string }>(shops: T[], activeId: string | null, saved: string | null, defaultId: string | null): T | null {
  if (activeId) return shops.find((shop) => shop.id === activeId) ?? null;
  return selectSupermarket(shops, saved, defaultId);
}
