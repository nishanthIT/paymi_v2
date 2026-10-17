import type { ListProduct, OutOfStockCollection, OutOfStockProduct, ShoppingList } from './types';

export type OverviewList = ShoppingList & { isOutOfStockCollection?: boolean; sourceListIds?: string[] };
export const OUT_OF_STOCK_ID = 'out-of-stock';

export function isOutOfStockList(name: string): boolean {
  return name === 'Out of Stock' || name.startsWith('Out of Stock · ');
}

/** Keep even empty originals reachable for sharing, rename and removal. */
export function outOfStockSources(lists: readonly ShoppingList[]): ShoppingList[] {
  return lists.filter(list => !list.id.startsWith('optimistic-') && isOutOfStockList(list.name));
}

/** Display-only aggregation; raw query data and every source list stay intact. */
export function collapseOutOfStockLists(lists: readonly ShoppingList[]): OverviewList[] {
  const unique = [...new Map(lists.map(list => [list.id, list])).values()];
  const sources = outOfStockSources(unique);
  if (!sources.length) return unique;
  const dates = sources.map(list => list.updatedAt).sort();
  const collection: OverviewList = {
    id: OUT_OF_STOCK_ID,
    name: 'Out of Stock',
    description: 'Items grouped by supplier shop',
    itemCount: sources.reduce((count, list) => count + (list.itemCount || 0), 0),
    createdAt: sources.map(list => list.createdAt).sort()[0],
    updatedAt: dates[dates.length - 1],
    isOutOfStockCollection: true,
    sourceListIds: sources.map(list => list.id),
  };
  let shown = false;
  return unique.flatMap(list => {
    if (list.id.startsWith('optimistic-') || !isOutOfStockList(list.name)) return [list];
    if (shown) return [];
    shown = true;
    return [collection];
  });
}

/** Use the dedicated out-of-stock action instead of picking a legacy container. */
export function ordinaryListTargets(lists: readonly ShoppingList[], sourceId?: string): ShoppingList[] {
  return lists.filter(list => list.id !== sourceId && !list.id.startsWith('optimistic-') && !isOutOfStockList(list.name));
}

/** Apply an existing list mutation to its rows only; retain real source IDs. */
export function patchOutOfStockSource(collection: OutOfStockCollection, listId: string, updater: (products: ListProduct[]) => ListProduct[]): OutOfStockCollection {
  const source = collection.products.filter(product => product.listId === listId);
  if (!source.length) return collection;
  const updated = updater(source).map(product => ({ ...product, listId, sourceListName: source[0].sourceListName }));
  return { ...collection, products: [...collection.products.filter(product => product.listId !== listId), ...updated] };
}

/** Roll back only the affected source; concurrent changes to other lists survive. */
export function restoreOutOfStockSource(collection: OutOfStockCollection, listId: string, products: readonly OutOfStockProduct[]): OutOfStockCollection {
  return { ...collection, products: [...collection.products.filter(product => product.listId !== listId), ...products] };
}
